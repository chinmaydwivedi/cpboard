"use client";

import { useMemo, useState } from "react";
import type { HeatmapData } from "@/types";
import { ChevronLeft, ChevronRight, Flame, CalendarDays } from "lucide-react";

const CELL = 11;
const GAP = 3;
const WEEKS = 52;
const DAY_MS = 86400000;
const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];
const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function intensity(count: number, isDark: boolean): string {
  const border = isDark ? "stroke-border/40" : "stroke-border/60";
  if (count === 0) return `fill-muted/30 ${border}`;
  if (count <= 2) return `fill-primary/30 ${border}`;
  if (count <= 5) return `fill-primary/55 ${border}`;
  if (count <= 10) return `fill-primary/80 ${border}`;
  return `fill-primary ${border}`;
}

function isoFromUtcTs(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function computeStats(data: HeatmapData, year: number, currentYear: number, todayUtcTs: number) {
  let activeDays = 0;
  let currentStreak = 0;
  let longestStreak = 0;

  const start = Date.UTC(year, 0, 1);
  const end = year === currentYear ? todayUtcTs : Date.UTC(year, 11, 31);
  const totalDays = Math.floor((end - start) / DAY_MS) + 1;

  const sorted: boolean[] = [];
  for (let i = 0; i < totalDays; i++) {
    const key = isoFromUtcTs(start + i * DAY_MS);
    const active = (data[key]?.total || 0) > 0;
    sorted.push(active);
    if (active) activeDays++;
  }

  let streak = 0;
  for (const active of sorted) {
    if (active) { streak++; longestStreak = Math.max(longestStreak, streak); }
    else streak = 0;
  }

  let cs = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i]) cs++;
    else break;
  }
  currentStreak = cs;

  return { activeDays, currentStreak, longestStreak };
}

export function Heatmap({ data, todayIso }: { data: HeatmapData; todayIso?: string }) {
  const safeTodayIso =
    todayIso && /^\d{4}-\d{2}-\d{2}$/.test(todayIso)
      ? todayIso
      : new Date().toISOString().slice(0, 10);
  const todayUtcTs = Date.parse(`${safeTodayIso}T00:00:00.000Z`);
  const currentYear = new Date(todayUtcTs).getUTCFullYear();
  const [year, setYear] = useState(currentYear);

  const { cells, months } = useMemo(() => {
    const isCurrentYear = year === currentYear;

    let startUtcTs: number;
    let endUtcTs: number;

    if (isCurrentYear) {
      const weekday = new Date(todayUtcTs).getUTCDay();
      startUtcTs = todayUtcTs - (WEEKS * 7 + weekday) * DAY_MS;
      endUtcTs = todayUtcTs;
    } else {
      const jan1UtcTs = Date.UTC(year, 0, 1);
      const dayOfWeek = new Date(jan1UtcTs).getUTCDay();
      startUtcTs = jan1UtcTs - dayOfWeek * DAY_MS;
      endUtcTs = Date.UTC(year, 11, 31);
    }

    const cells: { x: number; y: number; date: string; count: number }[] = [];
    const months: { label: string; x: number }[] = [];
    let prevMonth = -1;
    const maxWeeks = isCurrentYear ? WEEKS : 53;

    for (let w = 0; w <= maxWeeks; w++) {
      for (let d = 0; d < 7; d++) {
        const dateUtcTs = startUtcTs + (w * 7 + d) * DAY_MS;
        if (dateUtcTs > endUtcTs) continue;
        const date = new Date(dateUtcTs);
        if (!isCurrentYear && date.getUTCFullYear() !== year) continue;

        const dateStr = isoFromUtcTs(dateUtcTs);
        const entry = data[dateStr];

        const monthKey = date.getUTCFullYear() * 12 + date.getUTCMonth();
        if (d === 0 && monthKey !== prevMonth) {
          months.push({ label: MONTH_NAMES[date.getUTCMonth()], x: w * (CELL + GAP) + 28 });
          prevMonth = monthKey;
        }

        cells.push({
          x: w * (CELL + GAP) + 28,
          y: d * (CELL + GAP) + 20,
          date: dateStr,
          count: entry?.total || 0,
        });
      }
    }

    return { cells, months };
  }, [data, year, currentYear, todayUtcTs]);

  const stats = useMemo(
    () => computeStats(data, year, currentYear, todayUtcTs),
    [data, year, currentYear, todayUtcTs]
  );

  const totalW = (WEEKS + 2) * (CELL + GAP) + 32;
  const totalH = 7 * (CELL + GAP) + 28;

  const canGoNext = year < currentYear;
  const dataYears = Object.keys(data).map((d) => parseInt(d.split("-")[0]));
  const minYear = dataYears.length > 0 ? Math.min(...dataYears) : currentYear;
  const canGoPrev = year > minYear;

  return (
    <div className="rounded-lg border border-border bg-card/50 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <button
              onClick={() => canGoPrev && setYear(year - 1)}
              disabled={!canGoPrev}
              className="p-0.5 rounded hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm font-bold font-mono min-w-[3rem] text-center">{year}</span>
            <button
              onClick={() => canGoNext && setYear(year + 1)}
              disabled={!canGoNext}
              className="p-0.5 rounded hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">
              <span className="font-bold font-mono text-foreground">{stats.activeDays}</span> active days
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Flame className="h-3.5 w-3.5 text-primary" />
            <span className="text-xs text-muted-foreground">
              <span className="font-bold font-mono text-foreground">{stats.currentStreak}</span> day streak
            </span>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto pb-1">
        <svg width={totalW} height={totalH + 20} className="block">
          {months.map((m, i) => (
            <text
              key={i}
              x={m.x}
              y={12}
              className="fill-muted-foreground"
              fontSize={10}
              fontWeight={500}
            >
              {m.label}
            </text>
          ))}

          {DAYS.map((label, i) => (
            <text
              key={i}
              x={0}
              y={i * (CELL + GAP) + 20 + CELL - 2}
              className="fill-muted-foreground"
              fontSize={9}
              fontWeight={500}
            >
              {label}
            </text>
          ))}

          {cells.map((cell, i) => (
            <rect
              key={i}
              x={cell.x}
              y={cell.y}
              width={CELL}
              height={CELL}
              rx={2}
              strokeWidth={0.5}
              className={`${intensity(cell.count, true)} transition-all hover:stroke-primary hover:stroke-[1.5]`}
            >
              <title>{`${cell.count} submission${cell.count !== 1 ? "s" : ""} on ${cell.date}`}</title>
            </rect>
          ))}

          <text x={totalW - 140} y={totalH + 14} className="fill-muted-foreground" fontSize={9}>Less</text>
          {[0, 1, 3, 6, 11].map((v, i) => (
            <rect
              key={i}
              x={totalW - 110 + i * (CELL + 2)}
              y={totalH + 5}
              width={CELL}
              height={CELL}
              rx={2}
              strokeWidth={0.5}
              className={intensity(v, true)}
            />
          ))}
          <text x={totalW - 38} y={totalH + 14} className="fill-muted-foreground" fontSize={9}>More</text>
        </svg>
      </div>
    </div>
  );
}
