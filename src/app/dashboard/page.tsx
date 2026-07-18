import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { DashboardClient } from "./dashboard-client";
import { fetchCombinedTopicRadar } from "@/lib/topic-radar";

export default async function DashboardPage() {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayUtc = new Date(`${todayIso}T00:00:00.000Z`);
  const oneYearAgo = new Date(todayUtc.getTime() - 365 * 24 * 60 * 60 * 1000);
  let session;
  try {
    session = await getCurrentSession();
  } catch {
    redirect("/login");
  }

  if (!session?.user?.email) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: {
      id: true,
      name: true,
      username: true,
      email: true,
      avatarUrl: true,
      onboardingComplete: true,
      ownershipVerificationRequired: true,
      university: { select: { name: true, shortName: true } },
      platformProfiles: {
        orderBy: { platform: "asc" },
        select: {
          platform: true,
          handle: true,
          rating: true,
          maxRating: true,
          problemsSolved: true,
          rank: true,
          contestsCount: true,
          lastSynced: true,
          verified: true,
          verifiedAt: true,
        },
      },
      dailyActivities: {
        where: {
          date: {
            gte: oneYearAgo,
          },
        },
        orderBy: { date: "asc" },
        select: { date: true, platform: true, submissionCount: true },
      },
      notificationPreference: {
        select: {
          leaderAlerts: true,
          contestAlerts: true,
          contestLeadMinutes: true,
        },
      },
    },
  });

  if (!user) redirect("/login");
  if (!user.onboardingComplete) redirect("/onboarding");

  const heatmapData: Record<string, { total: number; byPlatform: Record<string, number> }> = {};
  const verifiedPlatforms = new Set(
    user.platformProfiles
      .filter((profile) => profile.verified)
      .map((profile) => profile.platform),
  );
  for (const activity of user.dailyActivities) {
    if (!verifiedPlatforms.has(activity.platform)) continue;
    const dateStr = activity.date.toISOString().split("T")[0];
    if (!heatmapData[dateStr]) {
      heatmapData[dateStr] = { total: 0, byPlatform: {} };
    }
    heatmapData[dateStr].total += activity.submissionCount;
    heatmapData[dateStr].byPlatform[activity.platform] = activity.submissionCount;
  }

  const codeforcesHandle =
    user.platformProfiles.find(
      (profile) => profile.platform === "CODEFORCES" && profile.verified,
    )?.handle || null;
  const leetcodeHandle =
    user.platformProfiles.find(
      (profile) => profile.platform === "LEETCODE" && profile.verified,
    )?.handle || null;
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
        verifiedAt: p.verifiedAt?.toISOString() || null,
      }))}
      heatmapData={heatmapData}
      todayIso={todayIso}
      topicRadar={topicRadar}
      topicHandles={{ codeforces: codeforcesHandle, leetcode: leetcodeHandle }}
      vapidPublicKey={
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
        process.env.VAPID_PRIVATE_KEY &&
        process.env.VAPID_SUBJECT
          ? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
          : null
      }
      notificationPreferences={{
        leaderAlerts: user.notificationPreference?.leaderAlerts ?? true,
        contestAlerts: user.notificationPreference?.contestAlerts ?? true,
        contestLeadMinutes: ([15, 30, 60].includes(
          user.notificationPreference?.contestLeadMinutes ?? 30,
        )
          ? user.notificationPreference?.contestLeadMinutes ?? 30
          : 30) as 15 | 30 | 60,
      }}
      ownershipVerificationRequired={user.ownershipVerificationRequired}
    />
  );
}
