import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";
import { fetchCombinedTopicRadar } from "@/lib/topic-radar";

export default async function DashboardPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayUtc = new Date(`${todayIso}T00:00:00.000Z`);
  const oneYearAgo = new Date(todayUtc.getTime() - 365 * 24 * 60 * 60 * 1000);
  let session;
  try {
    session = await auth();
  } catch {
    redirect("/login");
  }

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    include: {
      university: true,
      platformProfiles: {
        orderBy: { platform: "asc" },
      },
      dailyActivities: {
        where: {
          date: {
            gte: oneYearAgo,
          },
        },
        orderBy: { date: "asc" },
      },
      syncLogs: {
        orderBy: { syncedAt: "desc" },
        take: 10,
      },
    },
  });

  if (!user) redirect("/login");
  if (!user.onboardingComplete) redirect("/onboarding");

  const heatmapData: Record<string, { total: number; byPlatform: Record<string, number> }> = {};
  for (const activity of user.dailyActivities) {
    const dateStr = activity.date.toISOString().split("T")[0];
    if (!heatmapData[dateStr]) {
      heatmapData[dateStr] = { total: 0, byPlatform: {} };
    }
    heatmapData[dateStr].total += activity.submissionCount;
    heatmapData[dateStr].byPlatform[activity.platform] = activity.submissionCount;
  }

  const codeforcesHandle =
    user.platformProfiles.find((p) => p.platform === "CODEFORCES")?.handle || null;
  const leetcodeHandle =
    user.platformProfiles.find((p) => p.platform === "LEETCODE")?.handle || null;
  const topicRadar = await fetchCombinedTopicRadar({
    codeforcesHandle,
    leetcodeUsername: leetcodeHandle,
    topN: 12,
  });

  return (
    <DashboardClient
      user={{
        id: user.id,
        name: user.name,
        username: user.username,
        email: user.email,
        avatarUrl: user.avatarUrl,
        university: {
          name: user.university.name,
          shortName: user.university.shortName,
        },
      }}
      profiles={user.platformProfiles.map((p) => ({
        platform: p.platform,
        handle: p.handle,
        rating: p.rating,
        maxRating: p.maxRating,
        problemsSolved: p.problemsSolved,
        rank: p.rank,
        contestsCount: p.contestsCount,
        lastSynced: p.lastSynced?.toISOString() || null,
        verified: p.verified,
      }))}
      heatmapData={heatmapData}
      todayIso={todayIso}
      topicRadar={topicRadar}
      topicHandles={{ codeforces: codeforcesHandle, leetcode: leetcodeHandle }}
      recentSyncs={user.syncLogs.map((s) => ({
        platform: s.platform,
        status: s.status,
        error: s.error,
        syncedAt: s.syncedAt.toISOString(),
      }))}
    />
  );
}
