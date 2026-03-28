import { Platform } from "@prisma/client";
import type { PlatformData } from "@/types";
import { fetchCodeforcesData } from "./codeforces";
import { fetchLeetcodeData } from "./leetcode";
import { fetchAtcoderData } from "./atcoder";
import { fetchCodechefData } from "./codechef";

const fetchers: Record<Platform, (handle: string) => Promise<PlatformData>> = {
  CODEFORCES: fetchCodeforcesData,
  LEETCODE: fetchLeetcodeData,
  ATCODER: fetchAtcoderData,
  CODECHEF: fetchCodechefData,
};

export async function fetchPlatformData(
  platform: Platform,
  handle: string
): Promise<PlatformData> {
  const fetcher = fetchers[platform];
  if (!fetcher) throw new Error(`Unknown platform: ${platform}`);
  return fetcher(handle);
}

export async function syncUserPlatform(
  userId: string,
  platform: Platform,
  handle: string
) {
  const { prisma } = await import("@/lib/prisma");

  try {
    const existingProfile = await prisma.platformProfile.findUnique({
      where: { userId_platform: { userId, platform } },
      select: {
        rating: true,
        maxRating: true,
        problemsSolved: true,
        rank: true,
        contestsCount: true,
      },
    });

    const data = await fetchPlatformData(platform, handle);
    const mergedData: PlatformData = {
      ...data,
      rating:
        data.rating > 0 ? data.rating : (existingProfile?.rating ?? data.rating),
      maxRating: Math.max(data.maxRating, existingProfile?.maxRating ?? 0),
      problemsSolved:
        data.problemsSolved > 0
          ? data.problemsSolved
          : (existingProfile?.problemsSolved ?? data.problemsSolved),
      rank: data.rank || existingProfile?.rank || null,
      contestsCount:
        data.contestsCount > 0
          ? data.contestsCount
          : (existingProfile?.contestsCount ?? data.contestsCount),
    };

    await prisma.platformProfile.upsert({
      where: { userId_platform: { userId, platform } },
      create: {
        userId,
        platform,
        handle: mergedData.handle,
        rating: mergedData.rating,
        maxRating: mergedData.maxRating,
        problemsSolved: mergedData.problemsSolved,
        rank: mergedData.rank,
        contestsCount: mergedData.contestsCount,
        lastSynced: new Date(),
        verified: true,
      },
      update: {
        handle: mergedData.handle,
        rating: mergedData.rating,
        maxRating: mergedData.maxRating,
        problemsSolved: mergedData.problemsSolved,
        rank: mergedData.rank,
        contestsCount: mergedData.contestsCount,
        lastSynced: new Date(),
        verified: true,
      },
    });

    const activityEntries = Object.entries(mergedData.dailyActivity);
    if (activityEntries.length > 0) {
      const last365 = activityEntries
        .filter(([dateStr]) => {
          const d = new Date(dateStr);
          const yearAgo = new Date();
          yearAgo.setFullYear(yearAgo.getFullYear() - 1);
          return d >= yearAgo;
        })
        .slice(0, 500);

      for (const [dateStr, count] of last365) {
        await prisma.dailyActivity.upsert({
          where: {
            userId_platform_date: {
              userId,
              platform,
              date: new Date(dateStr),
            },
          },
          create: {
            userId,
            platform,
            date: new Date(dateStr),
            submissionCount: count,
          },
          update: {
            submissionCount: count,
          },
        });
      }
    }

    await prisma.syncLog.create({
      data: { userId, platform, status: "SUCCESS" },
    });

    return mergedData;
  } catch (error) {
    await prisma.syncLog.create({
      data: {
        userId,
        platform,
        status: "FAILED",
        error: error instanceof Error ? error.message : "Unknown error",
      },
    });
    throw error;
  }
}
