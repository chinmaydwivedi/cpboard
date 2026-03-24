"use client";

import { useMemo, useState } from "react";
import type { HeatmapData } from "@/types";
import { ChevronLeft, ChevronRight, Flame, CalendarDays } from "lucide-react";

const CELL = 11;
const GAP = 3;
const WEEKS = 52;
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

function computeStats(data: HeatmapData, year: number) {
  let activeDays = 0;
  let currentStreak = 0;
  let longestStreak = 0;

  const start = new Date(year, 0, 1);
  const end = year === new Date().getFullYear() ? new Date() : new Date(year, 11, 31);
  const totalDays = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;

  const sorted: boolean[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().split("T")[0];
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

export function Heatmap({ data }: { data: HeatmapData }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);

  const { cells, months } = useMemo(() => {
    const isCurrentYear = year === currentYear;
    const today = new Date();

    let start: Date;
    let endDate: Date;

    if (isCurrentYear) {
      start = new Date(today);
      start.setDate(start.getDate() - WEEKS * 7 - start.getDay());
      endDate = today;
    } else {
      start = new Date(year, 0, 1);
      const dayOfWeek = start.getDay();
      start.setDate(start.getDate() - dayOfWeek);
      endDate = new Date(year, 11, 31);
    }

    const cells: { x: number; y: number; date: string; count: number }[] = [];
    const months: { label: string; x: number }[] = [];
    let prevMonth = -1;
    const maxWeeks = isCurrentYear ? WEEKS : 53;

    for (let w = 0; w <= maxWeeks; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(date.getDate() + w * 7 + d);
        if (date > endDate) continue;
        if (!isCurrentYear && date.getFullYear() !== year) continue;

        const dateStr = date.toISOString().split("T")[0];
        const entry = data[dateStr];

        const monthKey = date.getFullYear() * 12 + date.getMonth();
        if (d === 0 && monthKey !== prevMonth) {
          months.push({ label: MONTH_NAMES[date.getMonth()], x: w * (CELL + GAP) + 28 });
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
  }, [data, year, currentYear]);

  const stats = useMemo(() => computeStats(data, year), [data, year]);

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
              <title>
                {cell.count} submission{cell.count !== 1 ? "s" : ""} on {cell.date}
              </title>
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
