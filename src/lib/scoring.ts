import type { PlatformProfile } from "@prisma/client";

type ScoreProfile = Pick<
  PlatformProfile,
  "platform" | "rating" | "maxRating" | "problemsSolved"
>;

export function computeTotalSolved(profiles: ScoreProfile[]): number {
  return profiles.reduce((sum, p) => sum + p.problemsSolved, 0);
}

// Intentionally LeetCode-only: ratings from different platforms are not on a
// comparable scale. Shown as "LC Rating" and used as the leaderboard tiebreak.
export function computeBestRating(profiles: ScoreProfile[]): number {
  const leetcode = profiles.find((p) => p.platform === "LEETCODE");
  if (!leetcode) return 0;
  return leetcode.rating || leetcode.maxRating || 0;
}

export function compareLeaderboardScores(
  a: { totalSolved: number; bestRating: number; username: string },
  b: { totalSolved: number; bestRating: number; username: string },
): number {
  return (
    b.totalSolved - a.totalSolved ||
    b.bestRating - a.bestRating ||
    (a.username < b.username ? -1 : a.username > b.username ? 1 : 0)
  );
}

/**
 * Codeforces rank hues, lifted so each one keeps at least 5:1 contrast on the
 * site's dark background (the official #0000ff blue is about 2.3:1).
 */
export function getCodeforcesRankColor(rating: number): string {
  if (rating >= 2400) return "#ff3b3b";
  if (rating >= 2100) return "#ff8c00";
  if (rating >= 1900) return "#c94fd6";
  if (rating >= 1600) return "#5b7cff";
  if (rating >= 1400) return "#03a89e";
  if (rating >= 1200) return "#2fb344";
  return "#9ca3af";
}

export function getCodeforcesRankTitle(rating: number): string {
  if (rating >= 3000) return "Legendary Grandmaster";
  if (rating >= 2600) return "International Grandmaster";
  if (rating >= 2400) return "Grandmaster";
  if (rating >= 2300) return "International Master";
  if (rating >= 2100) return "Master";
  if (rating >= 1900) return "Candidate Master";
  if (rating >= 1600) return "Expert";
  if (rating >= 1400) return "Specialist";
  if (rating >= 1200) return "Pupil";
  return "Newbie";
}
