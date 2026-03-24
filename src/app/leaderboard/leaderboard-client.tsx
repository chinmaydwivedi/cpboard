"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LeaderboardTable } from "@/components/leaderboard-table";
import type { LeaderboardEntry } from "@/types";

export function LeaderboardClient({
  entries,
  universities,
}: {
  entries: LeaderboardEntry[];
  universities: { shortName: string; name: string }[];
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
