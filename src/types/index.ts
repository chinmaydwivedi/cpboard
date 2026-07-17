import type { Platform } from "@prisma/client";

export type PlatformData = {
  handle: string;
  rating: number;
  maxRating: number;
  problemsSolved: number;
  rank: string | null;
  contestsCount: number;
  dailyActivity: Record<string, number>; // "YYYY-MM-DD" -> submission count
};

export type LeaderboardEntry = {
  rank: number;
  userId: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  universityShortName: string;
  universityName: string;
  totalSolved: number;
  platforms: {
    platform: Platform;
    handle: string;
    rating: number;
    maxRating: number;
    problemsSolved: number;
    rank: string | null;
  }[];
  bestRating: number;
  longestPotdStreak: number;
};

export type WeeklyLeader = {
  username: string;
  name: string | null;
  universityShortName: string;
  submissionCount: number;
  platformBreakdown: Partial<Record<Platform, number>>;
  weekLabel: string;
};

export type HeatmapData = Record<
  string,
  { total: number; byPlatform: Partial<Record<Platform, number>> }
>;

export type UserProfile = {
  id: string;
  username: string;
  name: string | null;
  avatarUrl: string | null;
  email: string;
  university: {
    name: string;
    shortName: string;
  };
  platforms: {
    platform: Platform;
    handle: string;
    rating: number;
    maxRating: number;
    problemsSolved: number;
    rank: string | null;
    contestsCount: number;
    lastSynced: Date | null;
  }[];
  heatmap: HeatmapData;
  totalSolved: number;
};

export const PLATFORM_COLORS: Record<Platform, string> = {
  CODEFORCES: "#1890ff",
  LEETCODE: "#ffa116",
  ATCODER: "#222",
  CODECHEF: "#5b4638",
};

export const PLATFORM_LABELS: Record<Platform, string> = {
  CODEFORCES: "Codeforces",
  LEETCODE: "LeetCode",
  ATCODER: "AtCoder",
  CODECHEF: "CodeChef",
};

export const CF_RANK_COLORS: Record<string, string> = {
  newbie: "#808080",
  pupil: "#008000",
  specialist: "#03a89e",
  expert: "#0000ff",
  "candidate master": "#aa00aa",
  master: "#ff8c00",
  "international master": "#ff8c00",
  grandmaster: "#ff0000",
  "international grandmaster": "#ff0000",
  "legendary grandmaster": "#ff0000",
};
