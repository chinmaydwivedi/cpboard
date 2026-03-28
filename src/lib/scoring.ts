import type { PlatformProfile } from "@prisma/client";

export function computeTotalSolved(profiles: PlatformProfile[]): number {
  return profiles.reduce((sum, p) => sum + p.problemsSolved, 0);
}

export function computeBestRating(profiles: PlatformProfile[]): number {
  const leetcode = profiles.find((p) => p.platform === "LEETCODE");
  if (!leetcode) return 0;
  return leetcode.rating || leetcode.maxRating || 0;
}

export function computeCompositeScore(profiles: PlatformProfile[]): number {
  const totalSolved = computeTotalSolved(profiles);
  const bestRating = computeBestRating(profiles);
  return totalSolved * 10 + bestRating;
}

export function getCodeforcesRankColor(rating: number): string {
  if (rating >= 3000) return "#ff0000";
  if (rating >= 2400) return "#ff0000";
  if (rating >= 2100) return "#ff8c00";
  if (rating >= 1900) return "#aa00aa";
  if (rating >= 1600) return "#0000ff";
  if (rating >= 1400) return "#03a89e";
  if (rating >= 1200) return "#008000";
  return "#808080";
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
