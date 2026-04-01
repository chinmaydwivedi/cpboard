import { notFound, redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./profile-client";
import type { HeatmapData } from "@/types";

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

  let viewerEmail: string | null = null;
  try {
    const session = await auth();
    viewerEmail = session?.user?.email ?? null;
  } catch {
    viewerEmail = null;
  }

  if (!viewerEmail) {
    redirect("/login");
  }

  const viewer = await prisma.user.findUnique({
    where: { email: viewerEmail },
    select: { id: true, email: true },
  });

  if (!viewer) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      university: true,
      platformProfiles: {
        orderBy: { platform: "asc" },
      },
      dailyActivities: {
        where: {
          date: { gte: oneYearAgo },
        },
        orderBy: { date: "asc" },
      },
    },
  });

  if (!user) notFound();
  let profileViews = user.profileViews;

  if (viewer.id !== user.id) {
    const updated = await prisma.user.update({
      where: { id: user.id },
      data: {
        profileViews: {
          increment: 1,
        },
      },
      select: { profileViews: true },
    });
    profileViews = updated.profileViews;
  }

  const heatmapData: HeatmapData = {};
  for (const activity of user.dailyActivities) {
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
      isOwner={viewer.id === user.id}
    />
  );
}
