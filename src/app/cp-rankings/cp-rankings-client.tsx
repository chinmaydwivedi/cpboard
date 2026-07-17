"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  Crown,
  TrendingUp,
  Users,
} from "lucide-react";

type CPUser = {
  rank: number;
  username: string;
  name: string | null;
  avatarUrl: string | null;
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
  topUsers,
  distribution,
  page,
  totalPages,
  totalUsers,
  highestRating,
  averageRating,
}: {
  users: CPUser[];
  topUsers: CPUser[];
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

      {topUsers.length > 0 && (
        <section
          className="relative overflow-hidden rounded-lg border border-border/60 bg-linear-to-b from-secondary/35 to-card px-4 pb-4 pt-8 sm:px-8 sm:pt-10"
          data-tour="cp-podium"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,color-mix(in_oklab,var(--primary)_10%,transparent),transparent_52%)]" />
          <div className="relative mb-7 text-center">
            <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
              Top rated
            </p>
            <h2 className="mt-1 text-sm font-semibold">Codeforces podium</h2>
          </div>

          <div className="relative mx-auto grid max-w-2xl gap-3 sm:grid-cols-3 sm:items-end">
            {[topUsers[1], topUsers[0], topUsers[2]]
              .filter((user): user is CPUser => Boolean(user))
              .map((user) => {
              const rankStyle = {
                1: {
                  ring: "border-amber-300/70 bg-amber-400/10",
                  crown: "text-amber-300",
                  label: "text-amber-300",
                  pedestal: "h-20 border-amber-400/20 bg-amber-400/8",
                },
                2: {
                  ring: "border-slate-300/60 bg-slate-300/10",
                  crown: "text-slate-300",
                  label: "text-slate-300",
                  pedestal: "h-14 border-slate-300/15 bg-slate-300/5",
                },
                3: {
                  ring: "border-orange-400/55 bg-orange-500/10",
                  crown: "text-orange-400",
                  label: "text-orange-400",
                  pedestal: "h-10 border-orange-400/15 bg-orange-500/5",
                },
              }[user.rank as 1 | 2 | 3];

              return (
                <article
                  key={user.username}
                  className={cn("flex flex-col items-center", user.rank === 1 && "sm:-translate-y-4")}
                >
                  <Crown className={cn("mb-2 size-5", rankStyle.crown)} fill="currentColor" />
                  <Link href={`/u/${user.username}`} className="group flex flex-col items-center">
                    <Avatar className={cn("size-20 border-2 shadow-lg", rankStyle.ring)}>
                      {user.avatarUrl && <AvatarImage src={user.avatarUrl} alt="" />}
                      <AvatarFallback className="text-xl font-semibold">
                        {(user.name || user.username).slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <p className="mt-3 max-w-40 truncate text-sm font-semibold transition-colors group-hover:text-primary">
                      {user.name || user.username}
                    </p>
                  </Link>
                  <p
                    className={cn("mt-1 font-mono text-lg font-bold", rankStyle.label)}
                    style={{ color: getCodeforcesRankColor(user.rating) }}
                  >
                    {user.rating}
                  </p>
                  <div
                    className={cn(
                      "mt-3 flex w-full flex-col items-center justify-center rounded-t-lg border border-b-0",
                      rankStyle.pedestal,
                    )}
                  >
                    <span className={cn("font-mono text-lg font-bold", rankStyle.label)}>
                      #{user.rank}
                    </span>
                    <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      {user.universityShortName}
                    </span>
                  </div>
                </article>
              );
              })}
          </div>
        </section>
      )}

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
