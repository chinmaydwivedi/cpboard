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
    const data = await fetchPlatformData(platform, handle);

    await prisma.platformProfile.upsert({
      where: { userId_platform: { userId, platform } },
      create: {
        userId,
        platform,
        handle: data.handle,
        rating: data.rating,
        maxRating: data.maxRating,
        problemsSolved: data.problemsSolved,
        rank: data.rank,
        contestsCount: data.contestsCount,
        lastSynced: new Date(),
        verified: true,
      },
      update: {
        handle: data.handle,
        rating: data.rating,
        maxRating: data.maxRating,
        problemsSolved: data.problemsSolved,
        rank: data.rank,
        contestsCount: data.contestsCount,
        lastSynced: new Date(),
        verified: true,
      },
    });

    const activityEntries = Object.entries(data.dailyActivity);
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

    return data;
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
