import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ProfileClient } from "./profile-client";
import type { HeatmapData } from "@/types";

export const revalidate = 60;

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;

  let user;
  try {
    user = await prisma.user.findUnique({
      where: { username },
      include: {
        university: true,
        platformProfiles: {
          orderBy: { platform: "asc" },
        },
        dailyActivities: {
          where: {
            date: { gte: new Date(Date.now() - 365 * 24 * 60 * 60 * 1000) },
          },
          orderBy: { date: "asc" },
        },
      },
    });
  } catch {
    notFound();
  }

  if (!user) notFound();

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
    />
  );
}
