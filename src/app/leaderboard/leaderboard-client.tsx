"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Award, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { LeaderboardEntry, WeeklyLeader } from "@/types";

export function LeaderboardClient({
  entries,
  universities,
  weeklyLeader,
}: {
  entries: LeaderboardEntry[];
  universities: { shortName: string; name: string }[];
  weeklyLeader: WeeklyLeader | null;
}) {
  const [search, setSearch] = useState("");
  const [uniFilter, setUniFilter] = useState("all");

  const filtered = entries.filter((e) => {
    const matchesSearch =
      !search ||
      e.username.toLowerCase().includes(search.toLowerCase()) ||
      (e.name || "").toLowerCase().includes(search.toLowerCase());
    const matchesUni =
      uniFilter === "all" || e.universityShortName === uniFilter;
    return matchesSearch && matchesUni;
  });

  const reranked = filtered.map((e, i) => ({ ...e, rank: i + 1 }));

  return (
    <div>
      <section
        className="relative mb-6 overflow-hidden rounded-lg border border-amber-500/20 bg-linear-to-r from-amber-500/8 via-card to-card px-4 py-4"
        data-tour="lb-weekly-spotlight"
      >
        <div className="absolute -right-8 -top-10 size-28 rounded-full bg-amber-400/5 blur-2xl" />
        {weeklyLeader ? (
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full border border-amber-400/25 bg-amber-400/10 text-amber-500">
                <Award className="size-5" />
              </span>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-500/90">
                    Weekly standout
                  </p>
                  <span className="font-mono text-[10px] text-muted-foreground">
                    {weeklyLeader.weekLabel}
                  </span>
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  <Link
                    href={`/u/${weeklyLeader.username}`}
                    className="font-semibold text-foreground transition-colors hover:text-primary"
                  >
                    {weeklyLeader.name || weeklyLeader.username}
                  </Link>{" "}
                  from {weeklyLeader.universityShortName} is leading this week&apos;s practice.
                </p>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-3 sm:border-l sm:border-border/50 sm:pl-4">
              <div>
                <p className="font-mono text-xl font-bold text-foreground">
                  {weeklyLeader.submissionCount}
                </p>
                <p className="text-[10px] text-muted-foreground">submissions this week</p>
              </div>
              <Link
                href={`/u/${weeklyLeader.username}`}
                aria-label={`View ${weeklyLeader.name || weeklyLeader.username}'s profile`}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ArrowUpRight className="size-4" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="relative flex items-center gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-400/10 text-amber-500">
              <Sparkles className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium">This week&apos;s spotlight is open</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Sync your profiles and start solving to claim the top spot.
              </p>
            </div>
          </div>
        )}
      </section>

      <div className="flex flex-col sm:flex-row gap-3 mb-6" data-tour="lb-filters">
        <Input
          placeholder="Search users..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="sm:max-w-xs bg-background"
        />
        <Select value={uniFilter} onValueChange={(v) => setUniFilter(v ?? "all")}>
          <SelectTrigger className="sm:w-48 bg-background">
            <SelectValue placeholder="All Universities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Universities</SelectItem>
            {universities.map((u) => (
              <SelectItem key={u.shortName} value={u.shortName}>
                {u.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {reranked.length > 0 ? (
        <LeaderboardTable entries={reranked} />
      ) : (
        <div className="text-center py-16">
          <p className="text-muted-foreground">No users found</p>
          <p className="text-xs text-muted-foreground mt-1">
            {entries.length === 0
              ? "Be the first to link your competitive programming profiles!"
              : "Try adjusting your filters"}
          </p>
        </div>
      )}
    </div>
  );
}
