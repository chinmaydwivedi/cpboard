import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeTotalSolved, computeBestRating } from "@/lib/scoring";
import { computePotdStreak, dateToDateKey } from "@/lib/potd";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { Badge } from "@/components/ui/badge";
import type { LeaderboardEntry } from "@/types";
import { withReadRetry } from "@/lib/read-retry";
import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const revalidate = 60;
export const dynamic = "force-dynamic";

const getUniversity = unstable_cache(
  (slug: string) =>
    withReadRetry(async () => {
      const university = await prisma.university.findUnique({
        where: { shortName: slug },
        select: {
          name: true,
          shortName: true,
          users: {
            select: {
              id: true,
              username: true,
              name: true,
              avatarUrl: true,
              platformProfiles: {
                where: { verified: true },
                select: {
                  platform: true,
                  handle: true,
                  rating: true,
                  maxRating: true,
                  problemsSolved: true,
                  rank: true,
                },
              },
              potdSolves: {
                where: { isVerified: true },
                select: { solvedDate: true },
                orderBy: { solvedDate: "asc" },
              },
            },
            where: {
              onboardingComplete: true,
              platformProfiles: { some: { verified: true } },
            },
          },
        },
      });
      if (!university) return null;
      return {
        name: university.name,
        shortName: university.shortName,
        users: university.users.map((user) => ({
          id: user.id,
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          platformProfiles: user.platformProfiles,
          potdSolveDateKeys: user.potdSolves.map((solve) =>
            dateToDateKey(solve.solvedDate),
          ),
        })),
      };
    }),
  ["university-leaderboard-v1"],
  {
    revalidate: 60,
    tags: [CACHE_TAGS.leaderboard, CACHE_TAGS.universities],
  },
);

export default async function UniversityLeaderboardPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const university = await getUniversity(slug);

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
      longestPotdStreak: computePotdStreak(
        user.potdSolveDateKeys,
      ).current,
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
    .sort(
      (a, b) =>
        b.totalSolved - a.totalSolved ||
        b.bestRating - a.bestRating ||
        a.username.localeCompare(b.username)
    )
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
