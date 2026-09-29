import type { Platform } from "@prisma/client";

/** Tinted card surface for a platform, shared by the dashboard and public profiles. */
export const PLATFORM_CARD_CLASS: Record<Platform, string> = {
  CODEFORCES: "border-blue-500/20 bg-blue-500/5",
  LEETCODE: "border-amber-500/20 bg-amber-500/5",
  ATCODER: "border-cyan-500/20 bg-cyan-500/5",
  CODECHEF: "border-orange-500/20 bg-orange-500/5",
};

/** Text color for a platform's name on its card. */
export const PLATFORM_ACCENT_CLASS: Record<Platform, string> = {
  CODEFORCES: "text-blue-600 dark:text-blue-400",
  LEETCODE: "text-amber-600 dark:text-amber-400",
  ATCODER: "text-cyan-600 dark:text-cyan-400",
  CODECHEF: "text-orange-600 dark:text-orange-400",
};
