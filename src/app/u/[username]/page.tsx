import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { getCurrentSession } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./profile-client";
import type { HeatmapData } from "@/types";
import { claimRateLimit } from "@/lib/security";

export const revalidate = 60;

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const todayUtc = new Date(`${todayIso}T00:00:00.000Z`);
  const oneYearAgo = new Date(todayUtc.getTime() - 365 * 24 * 60 * 60 * 1000);

  const { username } = await params;

  const userPromise = prisma.user.findUnique({
    where: { username, onboardingComplete: true },
    select: {
      id: true,
      username: true,
      name: true,
      avatarUrl: true,
      createdAt: true,
      profileViews: true,
      university: { select: { name: true, shortName: true } },
      platformProfiles: {
        where: { verified: true },
        orderBy: { platform: "asc" },
        select: {
          platform: true,
          handle: true,
          rating: true,
          maxRating: true,
          problemsSolved: true,
          rank: true,
          contestsCount: true,
        },
      },
      dailyActivities: {
        where: {
          date: { gte: oneYearAgo },
        },
        orderBy: { date: "asc" },
        select: { date: true, platform: true, submissionCount: true },
      },
    },
  });

  const [session, user] = await Promise.all([
    getCurrentSession().catch(() => null),
    userPromise,
  ]);

  if (!session?.user?.email) redirect("/login");

  if (!user) notFound();
  const profileViews = user.profileViews;
  const viewerUserId = session.user.id;

  if (viewerUserId !== user.id) {
    after(async () => {
      try {
        const claim = await claimRateLimit({
          scope: "profile-view",
          identifier: `${viewerUserId}:${user.id}`,
          limit: 1,
          windowMs: 60 * 60 * 1_000,
        });
        if (!claim.allowed) return;
        await prisma.user.update({
          where: { id: user.id },
          data: { profileViews: { increment: 1 } },
          select: { id: true },
        });
      } catch (error) {
        console.error("[PROFILE_VIEW] Failed to increment:", error);
      }
    });
  }

  const heatmapData: HeatmapData = {};
  const verifiedPlatforms = new Set(
    user.platformProfiles.map((profile) => profile.platform),
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

  const totalSolved = user.platformProfiles.reduce(
    (s, p) => s + p.problemsSolved,
    0
  );

  return (
    <ProfileClient
      user={{
        username: user.username,
        name: user.name,
        avatarUrl: user.avatarUrl,
        university: {
          name: user.university.name,
          shortName: user.university.shortName,
        },
        createdAt: user.createdAt.toISOString(),
      }}
      profiles={user.platformProfiles.map((p) => ({
        platform: p.platform,
        handle: p.handle,
        rating: p.rating,
        maxRating: p.maxRating,
        problemsSolved: p.problemsSolved,
        rank: p.rank,
        contestsCount: p.contestsCount,
      }))}
      heatmapData={heatmapData}
      totalSolved={totalSolved}
      profileVisits={profileViews}
      todayIso={todayIso}
      supportEmail="chinmaydhardwivedi@gmail.com"
      isOwner={viewerUserId === user.id}
    />
  );
}
