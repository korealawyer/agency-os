"use client";

import { useMemo } from "react";

export interface HeatmapCell {
  day: number;
  dayLabel: string;
  hour: number;
  hourLabel: string;
  clicks: number;
  impressions: number;
  cost: number;
  conversions: number;
  intensity: number;
}

interface HeatmapChartProps {
  data: HeatmapCell[];
  metric?: "clicks" | "impressions" | "cost" | "conversions";
}

const dayLabels = ["일", "월", "화", "수", "목", "금", "토"];

function getColor(value: number, max: number): string {
  if (max === 0 || value === 0) return "var(--surface-hover)";
  const ratio = Math.min(value / max, 1);
  // 파란색 그라데이션: 투명 → 진한 파랑
  const alpha = 0.1 + ratio * 0.85;
  return `rgba(30, 64, 175, ${alpha.toFixed(2)})`;
}

export default function HeatmapChart({ data, metric = "clicks" }: HeatmapChartProps) {
  const { maxValue, grid } = useMemo(() => {
    let maxVal = 0;
    const g: Record<string, HeatmapCell> = {};
    for (const cell of data) {
      const val = cell[metric];
      if (val > maxVal) maxVal = val;
      g[`${cell.day}-${cell.hour}`] = cell;
    }
    return { maxValue: maxVal, grid: g };
  }, [data, metric]);

  const metricLabels: Record<string, string> = {
    clicks: "클릭수",
    impressions: "노출수",
    cost: "비용",
    conversions: "전환수",
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="heatmap-chart">
      <div className="heatmap-header">
        <div className="heatmap-corner" />
        {hours.map(h => (
          <div key={h} className="heatmap-hour-label">
            {h % 3 === 0 ? `${h}시` : ""}
          </div>
        ))}
      </div>
      {dayLabels.map((label, dow) => (
        <div key={dow} className="heatmap-row">
          <div className="heatmap-day-label">{label}</div>
          {hours.map(hour => {
            const cell = grid[`${dow}-${hour}`];
            const value = cell ? cell[metric] : 0;
            return (
              <div
                key={hour}
                className="heatmap-cell"
                style={{ background: getColor(value, maxValue) }}
                title={`${label} ${hour}시 — ${metricLabels[metric]}: ${typeof value === 'number' ? value.toLocaleString() : value}`}
              >
                {value > 0 && maxValue > 0 && value / maxValue > 0.3 && (
                  <span className="heatmap-cell-value">
                    {value >= 1000 ? `${(value / 1000).toFixed(0)}k` : value}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      ))}
      {/* 범례 */}
      <div className="heatmap-legend">
        <span className="heatmap-legend-label">낮음</span>
        <div className="heatmap-legend-gradient" />
        <span className="heatmap-legend-label">높음</span>
      </div>
    </div>
  );
}
