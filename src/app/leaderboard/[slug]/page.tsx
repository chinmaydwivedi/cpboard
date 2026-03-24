import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeTotalSolved, computeBestRating } from "@/lib/scoring";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Badge } from "@/components/ui/badge";
import type { LeaderboardEntry } from "@/types";

export const revalidate = 60;

export default async function UniversityLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let university;
  try {
    university = await prisma.university.findUnique({
      where: { shortName: slug },
      include: {
        users: {
          include: { platformProfiles: true },
          where: { platformProfiles: { some: {} } },
        },
      },
    });
  } catch {
    notFound();
  }

  if (!university) notFound();

  const entries: LeaderboardEntry[] = university.users
    .map((user) => ({
      userId: user.id,
      username: user.username,
      name: user.name,
      avatarUrl: user.avatarUrl,
      universityShortName: university.shortName,
      universityName: university.name,
      totalSolved: computeTotalSolved(user.platformProfiles),
      bestRating: computeBestRating(user.platformProfiles),
      platforms: user.platformProfiles.map((p) => ({
        platform: p.platform,
        handle: p.handle,
        rating: p.rating,
        maxRating: p.maxRating,
        problemsSolved: p.problemsSolved,
        rank: p.rank,
      })),
      rank: 0,
    }))
    .sort((a, b) => b.totalSolved - a.totalSolved)
    .map((e, i) => ({ ...e, rank: i + 1 }));

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-8" data-tour="lb-uni-header">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">{university.name}</h1>
          <Badge variant="outline" className="font-mono">
            {university.shortName}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {entries.length} active member{entries.length !== 1 ? "s" : ""}
        </p>
      </div>

      {entries.length > 0 ? (
        <LeaderboardTable entries={entries} showUniversity={false} />
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">
            No members have linked their profiles yet.
          </p>
        </div>
      )}
    </div>
  );
}
