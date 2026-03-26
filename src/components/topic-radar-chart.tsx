"use client";

import { useEffect, useMemo, useRef } from "react";
import {
  Chart,
  Filler,
  Legend,
  LineElement,
  PointElement,
  RadarController,
  RadialLinearScale,
  Tooltip,
} from "chart.js";
import type { TopicRadarPoint } from "@/lib/topic-radar";

Chart.register(RadarController, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);
const SCALE_MARKERS = [5, 10, 20, 30, 100, 200, 300];
const SCALE_MAX = SCALE_MARKERS.length;

function toScalePosition(count: number): number {
  const c = Math.max(0, count);
  if (c <= 0) return 0;
  if (c <= SCALE_MARKERS[0]) return c / SCALE_MARKERS[0];

  for (let i = 0; i < SCALE_MARKERS.length - 1; i++) {
    const lo = SCALE_MARKERS[i];
    const hi = SCALE_MARKERS[i + 1];
    if (c <= hi) {
      // Log interpolation gives a more natural spread across non-linear marker jumps.
      const t = (Math.log10(c) - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo));
      return i + 1 + t;
    }
  }

  // Cap values above the last marker at the outer ring.
  return SCALE_MAX;
}

export function TopicRadarChart({
  data,
  codeforcesHandle,
  leetcodeHandle,
}: {
  data: TopicRadarPoint[];
  codeforcesHandle?: string | null;
  leetcodeHandle?: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scaledData = useMemo(() => data.map((d) => toScalePosition(d.count)), [data]);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const colors = {
      fill: "rgba(251, 113, 133, 0.24)",
      border: "rgba(251, 113, 133, 0.95)",
      point: "rgba(254, 205, 211, 0.95)",
      label: "rgba(255,255,255,0.92)",
      tick: "rgba(255,255,255,0.78)",
      grid: "rgba(255,255,255,0.20)",
      angle: "rgba(255,255,255,0.30)",
    };

    const chart = new Chart(canvasRef.current, {
      type: "radar",
      data: {
        labels: data.map((d) => d.topic),
        datasets: [
          {
            label: "Solved Topic Frequency",
            data: scaledData,
            backgroundColor: colors.fill,
            borderColor: colors.border,
            borderWidth: 2,
            pointBackgroundColor: colors.point,
            pointBorderColor: colors.border,
            pointBorderWidth: 1,
            pointRadius: 2.5,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                const topic = data[ctx.dataIndex];
                if (!topic) return "";
                return `${topic.topic}: ${topic.count} (CF ${topic.codeforces}, LC ${topic.leetcode})`;
              },
            },
          },
        },
        scales: {
          r: {
            min: 0,
            max: SCALE_MAX,
            ticks: {
              stepSize: 1,
              color: colors.tick,
              backdropColor: "transparent",
              callback: (tickValue) => {
                const value = Number(tickValue);
                if (!Number.isInteger(value) || value < 1 || value > SCALE_MAX) return "";
                return `${SCALE_MARKERS[value - 1]}`;
              },
            },
            angleLines: {
              color: colors.angle,
              lineWidth: 1,
            },
            grid: {
              color: colors.grid,
              lineWidth: 1,
            },
            pointLabels: {
              color: colors.label,
              font: { size: 11, weight: 500 },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [data, scaledData]);

  return (
    <div className="rounded-lg border border-border/80 bg-card/60 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Topic Radar (Codeforces + LeetCode)</p>
        <p className="text-[11px] text-muted-foreground">Scale markers: 5, 10, 20, 30, 100, 200, 300</p>
      </div>

      {(codeforcesHandle || leetcodeHandle) && (
        <p className="mb-3 text-[11px] text-muted-foreground">
          {codeforcesHandle ? `CF: ${codeforcesHandle}` : "CF: not linked"} ·{" "}
          {leetcodeHandle ? `LC: ${leetcodeHandle}` : "LC: not linked"}
        </p>
      )}

      {data.length === 0 ? (
        <div className="rounded-md border border-border/40 bg-muted/20 p-4 text-xs text-muted-foreground">
          No topic data yet. Link and sync your Codeforces and LeetCode profiles to see the radar.
        </div>
      ) : (
        <div className="h-[360px] w-full">
          <canvas ref={canvasRef} />
        </div>
      )}
    </div>
  );
}
