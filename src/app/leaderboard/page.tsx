import { prisma } from "@/lib/prisma";
import { unstable_cache } from "next/cache";
import {
  compareLeaderboardScores,
  computeTotalSolved,
  computeBestRating,
} from "@/lib/scoring";
import { LeaderboardClient } from "./leaderboard-client";
import type { LeaderboardEntry, WeeklyLeader } from "@/types";
import { CACHE_TAGS } from "@/lib/cache-tags";

export const revalidate = 60;

function getCurrentWeek() {
  const now = new Date();
  const day = now.getUTCDay();
  const daysSinceMonday = day === 0 ? 6 : day - 1;
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  const end = new Date(start);
  end.setUTCDate(end.getUTCDate() + 7);
  const weekLabel = `${start.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })}–${new Date(end.getTime() - 1).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  })}`;
  return { start, end, weekLabel };
}

const getLeaderboard = unstable_cache(
  async (): Promise<{
    entries: LeaderboardEntry[];
    weeklyLeader: WeeklyLeader | null;
  }> => {
    try {
      const week = getCurrentWeek();
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          name: true,
          avatarUrl: true,
          university: { select: { shortName: true, name: true } },
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
          dailyActivities: {
            where: { date: { gte: week.start, lt: week.end } },
            select: { platform: true, submissionCount: true },
          },
        },
        where: {
          onboardingComplete: true,
          platformProfiles: { some: { verified: true } },
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
        longestPotdStreak: 0,
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

      entries.sort(compareLeaderboardScores);
      entries.forEach((entry, index) => (entry.rank = index + 1));

      const weeklyWinner = [...users]
        .map((user) => {
          const verifiedPlatforms = new Set(
            user.platformProfiles.map((profile) => profile.platform),
          );
          const verifiedActivity = user.dailyActivities.filter((activity) =>
            verifiedPlatforms.has(activity.platform),
          );
          return {
          username: user.username,
          name: user.name,
          universityShortName: user.university.shortName,
          submissionCount: verifiedActivity.reduce(
            (total, activity) => total + activity.submissionCount,
            0,
          ),
          platformBreakdown: verifiedActivity.reduce<
            WeeklyLeader["platformBreakdown"]
          >((totals, activity) => {
            totals[activity.platform] =
              (totals[activity.platform] ?? 0) + activity.submissionCount;
            return totals;
          }, {}),
          weekLabel: week.weekLabel,
          };
        })
        .sort(
          (a, b) =>
            b.submissionCount - a.submissionCount ||
            a.username.localeCompare(b.username),
        )[0];

      return {
        entries,
        weeklyLeader:
          weeklyWinner && weeklyWinner.submissionCount > 0 ? weeklyWinner : null,
      };
    } catch {
      return { entries: [], weeklyLeader: null };
    }
  },
  ["global-leaderboard-v2"],
  { revalidate: 60, tags: [CACHE_TAGS.leaderboard] },
);

const getUniversities = unstable_cache(
  async () => {
    try {
      return await prisma.university.findMany({
        select: { shortName: true, name: true },
        orderBy: { name: "asc" },
      });
    } catch {
      return [];
    }
  },
  ["leaderboard-universities"],
  { revalidate: 300, tags: [CACHE_TAGS.universities] },
);

export default async function LeaderboardPage() {
  const [leaderboard, universities] = await Promise.all([
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

      <LeaderboardClient
        entries={leaderboard.entries}
        universities={universities}
        weeklyLeader={leaderboard.weeklyLeader}
      />
    </div>
  );
}
