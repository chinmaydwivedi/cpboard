"use client";

import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { CalendarPlus, Clock3, ExternalLink, Radio } from "lucide-react";
import type { Contest } from "@/lib/contests";
import { cn } from "@/lib/utils";

const PLATFORM_META: Record<string, { name: string; short: string; color: string }> = {
  "codeforces.com": { name: "Codeforces", short: "CF", color: "#3b82f6" },
  "leetcode.com": { name: "LeetCode", short: "LC", color: "#f59e0b" },
  "atcoder.jp": { name: "AtCoder", short: "AC", color: "#a3a3a3" },
  "codechef.com": { name: "CodeChef", short: "CC", color: "#a16207" },
};

function platformMeta(platform: string) {
  return PLATFORM_META[platform] ?? {
    name: platform.replace(/^www\./, ""),
    short: platform.slice(0, 2).toUpperCase(),
    color: "#8b5cf6",
  };
}

function formatDuration(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (!hours) return `${minutes}m`;
  return minutes ? `${hours}h ${minutes}m` : `${hours}h`;
}

function countdown(startTime: string, now: number) {
  const remaining = new Date(startTime).getTime() - now;
  if (remaining <= 0) return "Started";
  const minutes = Math.floor(remaining / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  if (days) return `in ${days}d ${hours}h`;
  if (hours) return `in ${hours}h ${minutes % 60}m`;
  return `in ${Math.max(1, minutes)}m`;
}

function googleCalendarUrl(contest: Contest) {
  const compact = (value: string) =>
    new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: contest.title,
    dates: `${compact(contest.startTime)}/${compact(contest.endTime)}`,
    details: `Competitive programming contest on ${platformMeta(contest.platform).name}.\n${contest.url}`,
    location: contest.url,
  });
  return `https://calendar.google.com/calendar/render?${params}`;
}

export function ContestsClient({ contests }: { contests: Contest[] }) {
  const platforms = useMemo(() => [...new Set(contests.map((contest) => contest.platform))], [contests]);
  const [selected, setSelected] = useState<string[]>(platforms);
  const [now, setNow] = useState(0);
  const mounted = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );

  useEffect(() => {
    const initial = window.setTimeout(() => setNow(Date.now()), 0);
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(timer);
    };
  }, []);

  const visible = useMemo(
    () => contests.filter((contest) => selected.includes(contest.platform)),
    [contests, selected],
  );
  const grouped = useMemo(() => {
    const groups = new Map<string, Contest[]>();
    for (const contest of visible) {
      const key = new Date(contest.startTime).toLocaleDateString("en-CA");
      groups.set(key, [...(groups.get(key) ?? []), contest]);
    }
    return [...groups.entries()];
  }, [visible]);

  const togglePlatform = (platform: string) => {
    setSelected((current) =>
      current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform],
    );
  };

  if (!mounted || now === 0) {
    return (
      <div className="space-y-3" aria-label="Loading contest calendar">
        <div className="h-14 animate-pulse rounded-lg bg-secondary/40" />
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-lg bg-secondary/30" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div
        className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 bg-card/50 p-3"
        data-tour="contests-filters"
      >
        <span className="mr-1 text-[11px] font-medium text-muted-foreground">Platforms</span>
        {platforms.map((platform) => {
          const meta = platformMeta(platform);
          const active = selected.includes(platform);
          return (
            <button
              key={platform}
              type="button"
              aria-pressed={active}
              onClick={() => togglePlatform(platform)}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors",
                active
                  ? "border-border bg-secondary text-foreground"
                  : "border-transparent text-muted-foreground/60 hover:text-foreground",
              )}
            >
              <span className="size-1.5 rounded-full" style={{ backgroundColor: meta.color }} />
              {meta.name}
            </button>
          );
        })}
        <span className="ml-auto hidden text-[10px] text-muted-foreground sm:block">
          Times shown in {Intl.DateTimeFormat().resolvedOptions().timeZone}
        </span>
      </div>

      <div className="space-y-7" data-tour="contests-list">
        {grouped.map(([date, dayContests]) => {
          const day = new Date(`${date}T12:00:00`);
          const today = new Date().toLocaleDateString("en-CA") === date;
          return (
            <section key={date}>
              <div className="mb-2.5 flex items-baseline gap-2">
                <h2 className="text-sm font-semibold">
                  {today ? "Today" : day.toLocaleDateString(undefined, { weekday: "long" })}
                </h2>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {day.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </span>
              </div>
              <div className="overflow-hidden rounded-lg border border-border/60">
                {dayContests.map((contest) => {
                  const meta = platformMeta(contest.platform);
                  const startsSoon = new Date(contest.startTime).getTime() - now < 3 * 60 * 60 * 1000;
                  return (
                    <article
                      key={contest.id}
                      className="group grid gap-3 border-b border-border/40 p-4 last:border-b-0 hover:bg-secondary/20 sm:grid-cols-[72px_1fr_auto] sm:items-center"
                    >
                      <div className="flex items-center gap-2 sm:block">
                        <div
                          className="inline-flex h-7 min-w-9 items-center justify-center rounded-md border px-2 font-mono text-[11px] font-semibold"
                          style={{ borderColor: `${meta.color}55`, color: meta.color }}
                        >
                          {meta.short}
                        </div>
                        <span className="text-[11px] text-muted-foreground sm:mt-1 sm:block">
                          {meta.name}
                        </span>
                      </div>

                      <div className="min-w-0">
                        <a
                          href={contest.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="line-clamp-2 text-sm font-medium transition-colors hover:text-primary"
                        >
                          {contest.title}
                        </a>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                          <span className="font-mono text-foreground/80">
                            {new Date(contest.startTime).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Clock3 className="size-3" /> {formatDuration(contest.durationSeconds)}
                          </span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 font-mono",
                              startsSoon && "text-primary",
                            )}
                          >
                            {startsSoon && <Radio className="size-3" />}
                            {countdown(contest.startTime, now)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 sm:justify-end">
                        <a
                          href={googleCalendarUrl(contest)}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Add ${contest.title} to Google Calendar`}
                          className="inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <CalendarPlus className="size-4" />
                        </a>
                        <a
                          href={contest.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90"
                        >
                          Open <ExternalLink className="size-3" />
                        </a>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          );
        })}

        {grouped.length === 0 && (
          <div className="rounded-lg border border-dashed border-border p-12 text-center">
            <p className="text-sm font-medium">No upcoming contests found</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Select another platform or check back after the schedule refreshes.
            </p>
          </div>
        )}
      </div>

      <p className="text-center text-[10px] text-muted-foreground/70">
        Schedule data aggregated from public contest listings. Always confirm timing on the official contest page.
      </p>
    </div>
  );
}
