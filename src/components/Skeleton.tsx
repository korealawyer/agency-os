'use client';

import React from 'react';

/* ── Base skeleton pulse ── */
function Pulse({ style, className }: { style?: React.CSSProperties; className?: string }) {
  return (
    <div
      className={className}
      style={{
        background: 'linear-gradient(90deg, var(--surface-hover) 25%, var(--border) 50%, var(--surface-hover) 75%)',
        backgroundSize: '200% 100%',
        animation: 'skeleton-pulse 1.5s ease-in-out infinite',
        borderRadius: 'var(--radius-md)',
        ...style,
      }}
    />
  );
}

/* ── KPI Card Skeleton ── */
export function KpiSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="kpi-grid">
      {Array.from({ length: count }).map((_, i) => (
        <div className="kpi-card" key={i} style={{ pointerEvents: 'none' }}>
          <Pulse style={{ width: 40, height: 40, borderRadius: 'var(--radius-lg)' }} />
          <Pulse style={{ width: '60%', height: 12, marginTop: 12 }} />
          <Pulse style={{ width: '40%', height: 24, marginTop: 8 }} />
          <Pulse style={{ width: '30%', height: 14, marginTop: 6 }} />
        </div>
      ))}
    </div>
  );
}

/* ── Table Skeleton ── */
export function TableSkeleton({ rows = 5, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <div className="card">
      <div className="table-wrapper">
        <table>
          <thead>
            <tr>
              {Array.from({ length: cols }).map((_, i) => (
                <th key={i}><Pulse style={{ width: 60, height: 14 }} /></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }).map((_, r) => (
              <tr key={r}>
                {Array.from({ length: cols }).map((_, c) => (
                  <td key={c}><Pulse style={{ width: `${50 + Math.random() * 40}%`, height: 14 }} /></td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Chart Skeleton ── */
export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="card">
      <div className="card-header">
        <Pulse style={{ width: 160, height: 18 }} />
      </div>
      <div className="card-body">
        <Pulse style={{ width: '100%', height, borderRadius: 'var(--radius-lg)' }} />
      </div>
    </div>
  );
}

/* ── Card Skeleton ── */
export function CardSkeleton({ height = 120 }: { height?: number }) {
  return (
    <div className="card" style={{ padding: 24 }}>
      <Pulse style={{ width: '40%', height: 16, marginBottom: 16 }} />
      <Pulse style={{ width: '100%', height: height - 40, borderRadius: 'var(--radius-lg)' }} />
    </div>
  );
}

/* ── Full Page Skeleton ── */
export function PageSkeleton() {
  return (
    <>
      <header className="main-header">
        <Pulse style={{ width: 120, height: 24 }} />
      </header>
      <div className="main-body">
        <KpiSkeleton count={4} />
        <div style={{ marginTop: 24 }}>
          <TableSkeleton rows={6} cols={5} />
        </div>
      </div>
    </>
  );
}
