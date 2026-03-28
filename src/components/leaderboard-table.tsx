"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PLATFORM_LABELS } from "@/types";
import type { LeaderboardEntry } from "@/types";
import type { Platform } from "@prisma/client";
import { ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 10;
const PLATFORM_SHORT_LABELS: Record<Platform, string> = {
  CODEFORCES: "CF",
  LEETCODE: "LC",
  ATCODER: "AC",
  CODECHEF: "CC",
};

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
  const [page, setPage] = useState(1);

  const entriesKey = useMemo(() => entries.map((e) => e.userId).join("|"), [entries]);
  useEffect(() => {
    setPage(1);
  }, [entriesKey]);

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

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const pageRows = sorted.slice(start, start + PAGE_SIZE);

  useEffect(() => {
    setPage((p) => Math.min(p, totalPages));
  }, [totalPages]);

  const pageItems = useMemo(() => {
    const total = totalPages;
    const cur = currentPage;
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1) as (number | "gap")[];
    const items: (number | "gap")[] = [1];
    const left = Math.max(2, cur - 1);
    const right = Math.min(total - 1, cur + 1);
    if (left > 2) items.push("gap");
    for (let i = left; i <= right; i++) items.push(i);
    if (right < total - 1) items.push("gap");
    if (total > 1) items.push(total);
    return items;
  }, [totalPages, currentPage]);

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
    <div className="rounded-lg border border-border/60 overflow-hidden" data-tour="lb-table">
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
                  {PLATFORM_SHORT_LABELS[p]}
                </th>
              ))}
              <th className="px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground text-right cursor-pointer" onClick={() => handleSort("bestRating")}>
                LC Rating
              </th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((entry) => (
              <tr key={entry.userId} className="border-b border-border/40 hover:bg-secondary/20 transition-colors">
                <td className="px-4 py-3 font-mono text-sm">{rankDisplay(entry.rank)}</td>
                <td className="px-4 py-3">
                  <Link href={`/u/${entry.username}`} className="flex items-center gap-2.5 hover:text-primary transition-colors">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[11px] font-semibold text-primary shrink-0 overflow-hidden">
                      {entry.avatarUrl ? (
                        <img src={entry.avatarUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        (entry.name || entry.username)[0].toUpperCase()
                      )}
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

      {sorted.length > PAGE_SIZE && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-border/60 bg-secondary/20">
          <p className="text-[11px] text-muted-foreground order-2 sm:order-1">
            Showing <span className="font-mono text-foreground">{start + 1}</span>–
            <span className="font-mono text-foreground">{Math.min(start + PAGE_SIZE, sorted.length)}</span> of{" "}
            <span className="font-mono text-foreground">{sorted.length}</span>
          </p>
          <div className="flex items-center gap-1 order-1 sm:order-2">
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={currentPage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center gap-0.5 mx-1">
              {pageItems.map((item, idx) =>
                item === "gap" ? (
                  <span key={`gap-${idx}`} className="px-1 text-muted-foreground text-xs">
                    …
                  </span>
                ) : (
                  <Button
                    key={item}
                    variant={item === currentPage ? "default" : "ghost"}
                    size="sm"
                    className="h-8 min-w-8 px-2 font-mono text-xs"
                    onClick={() => setPage(item)}
                  >
                    {item}
                  </Button>
                )
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="h-8 w-8 p-0"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
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
