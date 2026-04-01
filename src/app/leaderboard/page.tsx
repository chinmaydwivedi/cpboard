import { prisma } from "@/lib/prisma";
import { computeTotalSolved, computeBestRating } from "@/lib/scoring";
import { computePotdStreak, dateToDateKey } from "@/lib/potd";
import { LeaderboardClient } from "./leaderboard-client";
import type { LeaderboardEntry } from "@/types";

export const revalidate = 60;

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  try {
    const users = await prisma.user.findMany({
      include: {
        university: true,
        platformProfiles: true,
        potdSolves: {
          select: { solvedDate: true },
          orderBy: { solvedDate: "asc" },
        },
      },
      where: {
        platformProfiles: { some: {} },
      },
    });

    const entries: LeaderboardEntry[] = users.map((user) => ({
      userId: user.id,
      username: user.username,
      name: user.name,
      avatarUrl: user.avatarUrl,
      universityShortName: user.university.shortName,
      universityName: user.university.name,
      totalSolved: computeTotalSolved(user.platformProfiles),
      bestRating: computeBestRating(user.platformProfiles),
      longestPotdStreak: computePotdStreak(
        user.potdSolves.map((solve) => dateToDateKey(solve.solvedDate))
      ).longest,
      platforms: user.platformProfiles.map((p) => ({
        platform: p.platform,
        handle: p.handle,
        rating: p.rating,
        maxRating: p.maxRating,
        problemsSolved: p.problemsSolved,
        rank: p.rank,
      })),
      rank: 0,
    }));

    entries.sort(
      (a, b) =>
        b.totalSolved - a.totalSolved ||
        b.bestRating - a.bestRating ||
        a.username.localeCompare(b.username)
    );
    entries.forEach((e, i) => (e.rank = i + 1));

    return entries;
  } catch {
    return [];
  }
}

async function getUniversities() {
  try {
    return await prisma.university.findMany({
      select: { shortName: true, name: true },
      orderBy: { name: "asc" },
    });
  } catch {
    return [];
  }
}

export default async function LeaderboardPage() {
  const [entries, universities] = await Promise.all([
    getLeaderboard(),
    getUniversities(),
  ]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-8" data-tour="lb-header">
        <h1 className="text-2xl font-bold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Global rankings across all universities
        </p>
      </div>

      <LeaderboardClient entries={entries} universities={universities} />
    </div>
  );
}
