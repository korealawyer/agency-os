"use client";

import { useRef, ReactNode } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

export interface VirtualTableColumn<T> {
  key: string;
  header: ReactNode;
  width?: string;
  render: (row: T, index: number) => ReactNode;
  sticky?: boolean;
}

interface VirtualTableProps<T> {
  data: T[];
  columns: VirtualTableColumn<T>[];
  rowHeight?: number;
  maxHeight?: number;
  onRowClick?: (row: T, index: number) => void;
  rowClassName?: (row: T, index: number) => string;
  emptyMessage?: string;
  /** 가상 스크롤 활성화 기준 row 수 (기본: 50) */
  virtualThreshold?: number;
}

export default function VirtualTable<T>({
  data,
  columns,
  rowHeight = 52,
  maxHeight = 600,
  onRowClick,
  rowClassName,
  emptyMessage = "데이터가 없습니다.",
  virtualThreshold = 50,
}: VirtualTableProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);
  const useVirtual = data.length > virtualThreshold;

  const virtualizer = useVirtualizer({
    count: data.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => rowHeight,
    overscan: 10,
  });

  // ── 일반 테이블 (데이터 적을 때) ──
  if (!useVirtual) {
    return (
      <div className="table-wrapper">
        <table className="table-sticky">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>{col.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.length === 0 ? (
              <tr>
                <td colSpan={columns.length} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              data.map((row, idx) => (
                <tr
                  key={idx}
                  className={rowClassName?.(row, idx)}
                  onClick={() => onRowClick?.(row, idx)}
                  style={{ cursor: onRowClick ? "pointer" : undefined }}
                >
                  {columns.map((col) => (
                    <td key={col.key}>{col.render(row, idx)}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    );
  }

  // ── 가상 스크롤 테이블 (대량 데이터) ──
  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div className="virtual-table-container">
      {/* 고정 헤더 */}
      <div className="virtual-table-header">
        <table className="table-sticky">
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} style={{ width: col.width }}>{col.header}</th>
              ))}
            </tr>
          </thead>
        </table>
      </div>

      {/* 가상 스크롤 바디 */}
      <div
        ref={parentRef}
        className="virtual-table-body"
        style={{ maxHeight, overflowY: "auto" }}
      >
        <div style={{ height: virtualizer.getTotalSize(), position: "relative" }}>
          <table className="table-sticky" style={{ position: "absolute", top: 0, left: 0, width: "100%" }}>
            <tbody>
              {virtualItems.map((virtualRow) => {
                const row = data[virtualRow.index];
                return (
                  <tr
                    key={virtualRow.index}
                    data-index={virtualRow.index}
                    ref={virtualizer.measureElement}
                    className={rowClassName?.(row, virtualRow.index)}
                    onClick={() => onRowClick?.(row, virtualRow.index)}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`,
                      cursor: onRowClick ? "pointer" : undefined,
                    }}
                  >
                    {columns.map((col) => (
                      <td key={col.key} style={{ width: col.width }}>{col.render(row, virtualRow.index)}</td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {data.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
            {emptyMessage}
          </div>
        )}
      </div>

      {/* 행 수 표시 */}
      <div className="virtual-table-footer">
        <span>총 {data.length.toLocaleString()}개 행</span>
        {useVirtual && <span className="badge badge-info">가상 스크롤 활성</span>}
      </div>
    </div>
  );
}
