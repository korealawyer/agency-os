"use client";

export interface FunnelStep {
  label: string;
  value: number;
  color?: string;
}

const defaultColors = ["#1E40AF", "#3B82F6", "#60A5FA", "#93C5FD", "#BFDBFE"];

export default function FunnelChart({ data }: { data: FunnelStep[] }) {
  if (!data.length) return null;
  const maxValue = data[0].value;

  return (
    <div className="funnel-chart">
      {data.map((step, i) => {
        const widthPct = maxValue > 0 ? (step.value / maxValue) * 100 : 0;
        const dropoff = i > 0 && data[i - 1].value > 0
          ? ((1 - step.value / data[i - 1].value) * 100).toFixed(1)
          : null;
        const color = step.color || defaultColors[i % defaultColors.length];

        return (
          <div key={step.label} className="funnel-step">
            {dropoff && (
              <div className="funnel-dropoff">
                ▼ {dropoff}% 이탈
              </div>
            )}
            <div className="funnel-bar-wrap">
              <div className="funnel-bar" style={{ width: `${Math.max(widthPct, 8)}%`, background: color }} />
            </div>
            <div className="funnel-info">
              <span className="funnel-label">{step.label}</span>
              <span className="funnel-value">{step.value.toLocaleString()}</span>
              <span className="funnel-pct">{widthPct.toFixed(1)}%</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
