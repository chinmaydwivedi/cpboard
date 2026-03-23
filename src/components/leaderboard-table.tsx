"use client";

import { useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { PLATFORM_LABELS } from "@/types";
import type { LeaderboardEntry } from "@/types";
import type { Platform } from "@prisma/client";
import { ArrowUpDown } from "lucide-react";

type SortKey = "rank" | "totalSolved" | "bestRating" | "CODEFORCES" | "LEETCODE" | "ATCODER" | "CODECHEF";

export function LeaderboardTable({
  entries,
  showUniversity = true,
}: {
  entries: LeaderboardEntry[];
  showUniversity?: boolean;
}) {
  const [sortKey, setSortKey] = useState<SortKey>("rank");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...entries].sort((a, b) => {
    let av: number, bv: number;
    if (sortKey === "rank") { av = a.rank; bv = b.rank; }
    else if (sortKey === "totalSolved") { av = a.totalSolved; bv = b.totalSolved; }
    else if (sortKey === "bestRating") { av = a.bestRating; bv = b.bestRating; }
    else {
      av = a.platforms.find((p) => p.platform === sortKey as Platform)?.problemsSolved || 0;
      bv = b.platforms.find((p) => p.platform === sortKey as Platform)?.problemsSolved || 0;
    }
    return sortAsc ? av - bv : bv - av;
  });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(key === "rank"); }
  };

  const rankDisplay = (rank: number) => {
    if (rank === 1) return <span title="1st">🥇</span>;
    if (rank === 2) return <span title="2nd">🥈</span>;
    if (rank === 3) return <span title="3rd">🥉</span>;
    return <span className="text-muted-foreground">{rank}</span>;
  };

  return (
    <div className="rounded-lg border border-border/60 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/30 text-left">
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground cursor-pointer w-14" onClick={() => handleSort("rank")}>
                #
              </th>
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">User</th>
              {showUniversity && <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground hidden md:table-cell">University</th>}
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right cursor-pointer" onClick={() => handleSort("totalSolved")}>
                Total
              </th>
              {(["CODEFORCES", "LEETCODE", "ATCODER", "CODECHEF"] as Platform[]).map((p) => (
                <th key={p} className="px-3 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right cursor-pointer hidden lg:table-cell" onClick={() => handleSort(p as SortKey)}>
                  {PLATFORM_LABELS[p].slice(0, 2)}
                </th>
              ))}
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right cursor-pointer" onClick={() => handleSort("bestRating")}>
                Rating
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((entry) => (
              <tr key={entry.userId} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                <td className="px-4 py-3 font-mono text-sm">{rankDisplay(entry.rank)}</td>
                <td className="px-4 py-3">
                  <Link href={`/u/${entry.username}`} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0">
                      {(entry.name || entry.username)[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-[13px] leading-tight">{entry.name || entry.username}</p>
                      <p className="text-[11px] text-muted-foreground">@{entry.username}</p>
                    </div>
                  </Link>
                </td>
                {showUniversity && (
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge variant="outline" className="font-mono text-[10px]">{entry.universityShortName}</Badge>
                  </td>
                )}
                <td className="px-4 py-3 text-right font-mono font-semibold text-primary">{entry.totalSolved}</td>
                {(["CODEFORCES", "LEETCODE", "ATCODER", "CODECHEF"] as Platform[]).map((p) => {
                  const prof = entry.platforms.find((pp) => pp.platform === p);
                  return (
                    <td key={p} className="px-3 py-3 text-right font-mono text-muted-foreground hidden lg:table-cell">
                      {prof ? prof.problemsSolved : "—"}
                    </td>
                  );
                })}
                <td className="px-4 py-3 text-right">
                  <span className="font-mono font-medium" style={{ color: entry.bestRating > 0 ? getRatingColor(entry.bestRating) : undefined }}>
                    {entry.bestRating > 0 ? entry.bestRating : "—"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getRatingColor(rating: number): string {
  if (rating >= 2400) return "#ef4444";
  if (rating >= 2100) return "#f97316";
  if (rating >= 1900) return "#a855f7";
  if (rating >= 1600) return "#6366f1";
  if (rating >= 1400) return "#06b6d4";
  if (rating >= 1200) return "#22c55e";
  return "#94a3b8";
}
