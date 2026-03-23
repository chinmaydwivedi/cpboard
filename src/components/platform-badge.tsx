import { cn } from "@/lib/utils";
import { PLATFORM_LABELS } from "@/types";
import type { Platform } from "@prisma/client";

const platformStyles: Record<Platform, string> = {
  CODEFORCES: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20",
  LEETCODE: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
  ATCODER: "bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-500/20",
  CODECHEF: "bg-orange-800/10 text-orange-600 dark:text-orange-400 border-orange-800/20",
};

export function PlatformBadge({
  platform,
  className,
}: {
  platform: Platform;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium",
        platformStyles[platform],
        className
      )}
    >
      {PLATFORM_LABELS[platform]}
    </span>
  );
}
