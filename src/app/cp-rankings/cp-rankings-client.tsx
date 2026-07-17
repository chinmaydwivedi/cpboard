"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { RatingDistributionChart } from "@/components/rating-chart";
import { getCodeforcesRankColor, getCodeforcesRankTitle } from "@/lib/scoring";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  Users,
} from "lucide-react";

type CPUser = {
  rank: number;
  username: string;
  name: string | null;
  handle: string;
  rating: number;
  maxRating: number;
  cfRank: string | null;
  universityShortName: string;
  contestsCount: number;
};

type DistributionEntry = {
  range: string;
  count: number;
  minRating: number;
};

export function CPRankingsClient({
  users,
  distribution,
  page,
  totalPages,
  totalUsers,
  highestRating,
  averageRating,
}: {
  users: CPUser[];
  distribution: DistributionEntry[];
  page: number;
  totalPages: number;
  totalUsers: number;
  highestRating: number;
  averageRating: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3" data-tour="cp-summary">
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Rated Users</span>
          </div>
          <p className="text-2xl font-bold font-mono">{totalUsers}</p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Highest Rating</span>
          </div>
          <p className="text-2xl font-bold font-mono">
            {highestRating > 0 ? (
              <span style={{ color: getCodeforcesRankColor(highestRating) }}>{highestRating}</span>
            ) : "—"}
          </p>
        </div>
        <div className="rounded-lg border border-border/60 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[11px] font-medium text-muted-foreground">Average Rating</span>
          </div>
          <p className="text-2xl font-bold font-mono">
            {averageRating > 0 ? averageRating : "—"}
          </p>
        </div>
      </div>

      {distribution.length > 0 && (
        <div className="rounded-lg border border-border/60 p-5" data-tour="cp-distribution">
          <p className="text-[11px] text-muted-foreground font-medium mb-4">Rating Distribution</p>
          <RatingDistributionChart data={distribution} />
        </div>
      )}

      <div className="rounded-lg border border-border/60 overflow-hidden" data-tour="cp-table">
        <div className="px-5 py-3 border-b border-border/60">
          <p className="text-sm font-medium">Rankings</p>
        </div>
        {users.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/40">
                  <TableHead className="w-14 text-[11px]">#</TableHead>
                  <TableHead className="text-[11px]">User</TableHead>
                  <TableHead className="hidden sm:table-cell text-[11px]">Handle</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px]">University</TableHead>
                  <TableHead className="text-right text-[11px]">Rating</TableHead>
                  <TableHead className="text-right hidden sm:table-cell text-[11px]">Max</TableHead>
                  <TableHead className="hidden md:table-cell text-[11px]">Rank</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.username} className="hover:bg-secondary/20 border-border/40">
                  <TableCell className="font-mono text-muted-foreground text-[13px]">{user.rank}</TableCell>
                  <TableCell>
                    <Link href={`/u/${user.username}`} className="font-medium text-[13px] hover:text-primary transition-colors">
                      {user.name || user.username}
                    </Link>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    <a
                      href={`https://codeforces.com/profile/${user.handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] text-muted-foreground hover:text-primary transition-colors"
                    >
                      {user.handle}
                    </a>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <Badge variant="outline" className="font-mono text-[10px]">{user.universityShortName}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono font-medium text-[13px]" style={{ color: getCodeforcesRankColor(user.rating) }}>
                      {user.rating}
                    </span>
                  </TableCell>
                  <TableCell className="text-right hidden sm:table-cell">
                    <span className="font-mono text-[13px]" style={{ color: getCodeforcesRankColor(user.maxRating) }}>
                      {user.maxRating}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <span className="text-xs font-medium" style={{ color: getCodeforcesRankColor(user.rating) }}>
                      {getCodeforcesRankTitle(user.rating)}
                    </span>
                  </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            {totalPages > 1 && (
              <nav
                aria-label="CP rankings pagination"
                className="flex items-center justify-between gap-4 border-t border-border/60 px-4 py-3"
              >
                <p className="text-xs text-muted-foreground">
                  Page {page} of {totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <Link
                    href={page > 2 ? `/cp-rankings?page=${page - 1}` : "/cp-rankings"}
                    aria-disabled={page === 1}
                    tabIndex={page === 1 ? -1 : undefined}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      page === 1 && "pointer-events-none opacity-50",
                    )}
                  >
                    <ChevronLeft />
                    Previous
                  </Link>
                  <Link
                    href={`/cp-rankings?page=${page + 1}`}
                    aria-disabled={page === totalPages}
                    tabIndex={page === totalPages ? -1 : undefined}
                    className={cn(
                      buttonVariants({ variant: "outline", size: "sm" }),
                      page === totalPages && "pointer-events-none opacity-50",
                    )}
                  >
                    Next
                    <ChevronRight />
                  </Link>
                </div>
              </nav>
            )}
          </>
        ) : (
          <p className="text-center text-muted-foreground py-8 text-sm">
            No rated Codeforces users yet.
          </p>
        )}
      </div>
    </div>
  );
}
