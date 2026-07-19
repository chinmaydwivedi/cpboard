import type { Metadata } from "next";
import { Code2, ExternalLink } from "lucide-react";
import { getUpcomingContestFeed } from "@/lib/contests";
import { ContestsClient } from "./contests-client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Contest Calendar — CPBoard",
  description: "Upcoming Codeforces, LeetCode, AtCoder, and CodeChef contests in one calendar.",
};

export default async function ContestsPage() {
  const feed = await getUpcomingContestFeed();

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <div className="mb-7" data-tour="contests-header">
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary">
          Never miss a round
        </p>
        <h1 className="text-2xl font-bold tracking-tight">Contest Calendar</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Upcoming contests across the major competitive programming platforms.
        </p>
      </div>

      <a
        href="https://snippex-navy.vercel.app/"
        target="_blank"
        rel="noopener noreferrer"
        className="group mb-5 flex items-center gap-3 rounded-lg border border-border/60 bg-card/50 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-secondary/30"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Code2 className="size-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-medium">Need a CP snippet?</span>
          <span className="block text-xs text-muted-foreground">
            Browse copy-ready C++ templates and references on Snippex.
          </span>
        </span>
        <ExternalLink className="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
      </a>

      <ContestsClient contests={feed.contests} available={feed.available} />
    </div>
  );
}
