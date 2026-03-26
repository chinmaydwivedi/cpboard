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

function toLogValue(count: number): number {
  return Math.log10(Math.max(1, count));
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

  const axisMax = useMemo(() => {
    if (data.length === 0) return 3;
    const maxLog = Math.max(...data.map((d) => toLogValue(d.count)));
    return Math.max(3, Math.ceil(maxLog));
  }, [data]);

  useEffect(() => {
    if (!canvasRef.current || data.length === 0) return;

    const chart = new Chart(canvasRef.current, {
      type: "radar",
      data: {
        labels: data.map((d) => d.topic),
        datasets: [
          {
            label: "Solved Topic Frequency",
            data: data.map((d) => toLogValue(d.count)),
            backgroundColor: "rgba(255, 210, 84, 0.36)",
            borderColor: "#ffd45a",
            borderWidth: 2,
            pointBackgroundColor: "#ffe28a",
            pointBorderColor: "#ffd45a",
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
            max: axisMax,
            ticks: {
              stepSize: 1,
              color: "rgba(255,255,255,0.95)",
              backdropColor: "transparent",
              callback: (tickValue) => {
                const value = Number(tickValue);
                if (!Number.isFinite(value) || value < 0 || value > axisMax) return "";
                return `${Math.round(10 ** value)}`;
              },
            },
            angleLines: {
              color: "rgba(255,255,255,0.45)",
              lineWidth: 1,
            },
            grid: {
              color: "rgba(255,255,255,0.3)",
              lineWidth: 1,
            },
            pointLabels: {
              color: "rgba(255,255,255,0.95)",
              font: { size: 11, weight: 500 },
            },
          },
        },
      },
    });

    return () => chart.destroy();
  }, [axisMax, data]);

  return (
    <div className="rounded-lg border border-[#21334f] bg-[#020816] p-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-white">Topic Radar (Codeforces + LeetCode)</p>
        <p className="text-[11px] text-white/70">Radial scale is log-mapped: 1, 10, 100, 1000...</p>
      </div>

      {(codeforcesHandle || leetcodeHandle) && (
        <p className="mb-3 text-[11px] text-white/60">
          {codeforcesHandle ? `CF: ${codeforcesHandle}` : "CF: not linked"} ·{" "}
          {leetcodeHandle ? `LC: ${leetcodeHandle}` : "LC: not linked"}
        </p>
      )}

      {data.length === 0 ? (
        <div className="rounded-md border border-white/10 bg-black/25 p-4 text-xs text-white/70">
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
