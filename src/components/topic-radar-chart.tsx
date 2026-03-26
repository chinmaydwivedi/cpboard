"use client";

import { useEffect, useMemo, useRef } from "react";
import { useTheme } from "next-themes";
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
  const { resolvedTheme } = useTheme();

  const maxCount = useMemo(() => Math.max(30, ...data.map((d) => d.count)), [data]);
  const scaledData = useMemo(
    () => data.map((d) => Math.max(1, Math.round((d.count / maxCount) * 30))),
    [data, maxCount]
  );

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;
    const isDark = resolvedTheme !== "light";
    const colors = isDark
      ? {
          fill: "rgba(251, 113, 133, 0.24)",
          border: "rgba(251, 113, 133, 0.95)",
          point: "rgba(254, 205, 211, 0.95)",
          label: "rgba(255,255,255,0.92)",
          tick: "rgba(255,255,255,0.75)",
          grid: "rgba(255,255,255,0.20)",
          angle: "rgba(255,255,255,0.30)",
        }
      : {
          fill: "rgba(244, 63, 94, 0.18)",
          border: "rgba(225, 29, 72, 0.95)",
          point: "rgba(159, 18, 57, 0.95)",
          label: "rgba(15,23,42,0.88)",
          tick: "rgba(51,65,85,0.82)",
          grid: "rgba(15,23,42,0.16)",
          angle: "rgba(15,23,42,0.24)",
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
            max: 30,
            ticks: {
              stepSize: 5,
              color: colors.tick,
              backdropColor: "transparent",
              callback: (tickValue) => {
                const value = Number(tickValue);
                return [5, 10, 20, 30].includes(value) ? `${value}` : "";
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
  }, [data, resolvedTheme, scaledData]);

  return (
    <div className="rounded-lg border border-border/40 bg-card/50 p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">Topic Radar (Codeforces + LeetCode)</p>
        <p className="text-[11px] text-muted-foreground">Scale markers: 5, 10, 20, 30</p>
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
