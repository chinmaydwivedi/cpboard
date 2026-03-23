"use client";

import { useMemo } from "react";
import type { HeatmapData } from "@/types";

const CELL = 11;
const GAP = 3;
const WEEKS = 52;
const DAYS = ["", "Mon", "", "Wed", "", "Fri", ""];

function intensity(count: number): string {
  if (count === 0) return "fill-muted/40";
  if (count <= 2) return "fill-primary/30";
  if (count <= 5) return "fill-primary/55";
  if (count <= 10) return "fill-primary/80";
  return "fill-primary";
}

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export function Heatmap({ data }: { data: HeatmapData }) {
  const { cells, months } = useMemo(() => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(start.getDate() - WEEKS * 7 - start.getDay());

    const cells: { x: number; y: number; date: string; count: number }[] = [];
    const months: { label: string; x: number }[] = [];
    let prevMonth = -1;

    for (let w = 0; w <= WEEKS; w++) {
      for (let d = 0; d < 7; d++) {
        const date = new Date(start);
        date.setDate(date.getDate() + w * 7 + d);
        if (date > today) continue;

        const dateStr = date.toISOString().split("T")[0];
        const entry = data[dateStr];

        if (date.getMonth() !== prevMonth) {
          months.push({ label: MONTH_NAMES[date.getMonth()], x: w * (CELL + GAP) + 28 });
          prevMonth = date.getMonth();
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
  }, [data]);

  const totalW = (WEEKS + 1) * (CELL + GAP) + 32;
  const totalH = 7 * (CELL + GAP) + 28;

  return (
    <div className="overflow-x-auto pb-2">
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
            className={`${intensity(cell.count)} transition-all hover:stroke-primary hover:stroke-1`}
          >
            <title>
              {cell.count} submission{cell.count !== 1 ? "s" : ""} on {cell.date}
            </title>
          </rect>
        ))}

        {/* legend */}
        <text x={totalW - 140} y={totalH + 14} className="fill-muted-foreground" fontSize={9}>Less</text>
        {[0, 1, 3, 6, 11].map((v, i) => (
          <rect
            key={i}
            x={totalW - 110 + i * (CELL + 2)}
            y={totalH + 5}
            width={CELL}
            height={CELL}
            rx={2}
            className={intensity(v)}
          />
        ))}
        <text x={totalW - 38} y={totalH + 14} className="fill-muted-foreground" fontSize={9}>More</text>
      </svg>
    </div>
  );
}
