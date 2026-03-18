"use client";

import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  TrendingUp, TrendingDown, ArrowUpDown, CheckCircle2,
  ChevronUp, ChevronDown,
} from "lucide-react";

const strategyLabels: Record<string, string> = {
  target_rank: "목표 순위", target_cpc: "목표 CPC", target_roas: "목표 ROAS",
  max_conversion: "최대 전환", time_based: "시간대 차등", manual: "수동",
};

export type SortKey = "text" | "bid" | "rank" | "ctr" | "cpc" | "conversions" | "cost" | "impressions" | "clicks" | "qi";
type SortDir = "asc" | "desc";

export interface KeywordRow {
  id: number;
  text: string;
  account: string;
  campaign: string;
  group: string;
  bid: number;
  rank: number;
  strategy: string;
  qi: number;
  impressions: number;
  clicks: number;
  ctr: number;
  cpc: number;
  conversions: number;
  cost: number;
  trend: "up" | "down";
}

interface KeywordTableProps {
  keywords: KeywordRow[];
  selectedKws: Set<number>;
  visibleCols: Set<string>;
  sortKey: SortKey | null;
  sortDir: SortDir;
  editingBid: number | null;
  editBidValue: string;
  editingStrategy: number | null;
  onToggleAll: () => void;
  onToggleRow: (id: number) => void;
  onSort: (key: SortKey) => void;
  onBidClick: (id: number, currentBid: number) => void;
  onBidChange: (val: string) => void;
  onBidSave: (id: number) => void;
  onBidCancel: () => void;
  onStrategyToggle: (id: number) => void;
  onStrategyChange: (id: number, strategy: string) => void;
}

// ── 헤더 행 (공통) ────────────────────────────────────────────────
function TableColgroup({ visibleCols }: { visibleCols: Set<string> }) {
  return (
    <colgroup>
      <col style={{ width: 36, minWidth: 36 }} />
      {visibleCols.has("text") && <col style={{ width: 240, minWidth: 240 }} />}
      {visibleCols.has("account") && <col style={{ width: 100, minWidth: 100 }} />}
      {visibleCols.has("campaign") && <col style={{ width: 120, minWidth: 120 }} />}
      {visibleCols.has("group") && <col style={{ width: 120, minWidth: 120 }} />}
      {visibleCols.has("bid") && <col style={{ width: 90, minWidth: 90 }} />}
      {visibleCols.has("rank") && <col style={{ width: 60, minWidth: 60 }} />}
      {visibleCols.has("strategy") && <col style={{ width: 80, minWidth: 80 }} />}
      {visibleCols.has("qi") && <col style={{ width: 60, minWidth: 60 }} />}
      {visibleCols.has("impressions") && <col style={{ width: 70, minWidth: 70 }} />}
      {visibleCols.has("clicks") && <col style={{ width: 70, minWidth: 70 }} />}
      {visibleCols.has("ctr") && <col style={{ width: 70, minWidth: 70 }} />}
      {visibleCols.has("cpc") && <col style={{ width: 70, minWidth: 70 }} />}
      {visibleCols.has("conversions") && <col style={{ width: 70, minWidth: 70 }} />}
      {visibleCols.has("cost") && <col style={{ width: 90, minWidth: 90 }} />}
    </colgroup>
  );
}

function TableHeader({
  keywords, selectedKws, visibleCols, sortKey, sortDir,
  onToggleAll, onSort,
}: Pick<KeywordTableProps, "keywords" | "selectedKws" | "visibleCols" | "sortKey" | "sortDir" | "onToggleAll" | "onSort">) {
  const SortIcon = ({ col }: { col: SortKey }) =>
    sortKey === col
      ? sortDir === "asc" ? <ChevronUp size={12} /> : <ChevronDown size={12} />
      : <ArrowUpDown size={12} />;

  return (
    <tr>
      <th style={{ width: 36, minWidth: 36 }}>
        <input type="checkbox" checked={selectedKws.size === keywords.length && keywords.length > 0} onChange={onToggleAll} />
      </th>
      {visibleCols.has("text") && <th style={{ minWidth: 160 }} className={`sortable ${sortKey === "text" ? "sort-active" : ""}`} onClick={() => onSort("text")}>키워드 <span className="sort-icon"><SortIcon col="text" /></span></th>}
      {visibleCols.has("account") && <th style={{ minWidth: 100 }}>계정</th>}
      {visibleCols.has("campaign") && <th style={{ minWidth: 120 }}>캠페인</th>}
      {visibleCols.has("group") && <th style={{ minWidth: 120 }}>광고그룹</th>}
      {visibleCols.has("bid") && <th style={{ minWidth: 80 }} className={`sortable ${sortKey === "bid" ? "sort-active" : ""}`} onClick={() => onSort("bid")}>입찰가 <span className="sort-icon"><SortIcon col="bid" /></span></th>}
      {visibleCols.has("rank") && <th style={{ minWidth: 60 }} className={`sortable ${sortKey === "rank" ? "sort-active" : ""}`} onClick={() => onSort("rank")}>순위 <span className="sort-icon"><SortIcon col="rank" /></span></th>}
      {visibleCols.has("strategy") && <th style={{ minWidth: 80 }}>전략</th>}
      {visibleCols.has("qi") && <th style={{ minWidth: 60 }} className={`sortable ${sortKey === "qi" ? "sort-active" : ""}`} onClick={() => onSort("qi")}>품질 <span className="sort-icon"><SortIcon col="qi" /></span></th>}
      {visibleCols.has("impressions") && <th style={{ minWidth: 70 }} className={`sortable ${sortKey === "impressions" ? "sort-active" : ""}`} onClick={() => onSort("impressions")}>노출 <span className="sort-icon"><SortIcon col="impressions" /></span></th>}
      {visibleCols.has("clicks") && <th style={{ minWidth: 60 }} className={`sortable ${sortKey === "clicks" ? "sort-active" : ""}`} onClick={() => onSort("clicks")}>클릭 <span className="sort-icon"><SortIcon col="clicks" /></span></th>}
      {visibleCols.has("ctr") && <th style={{ minWidth: 60 }} className={`sortable ${sortKey === "ctr" ? "sort-active" : ""}`} onClick={() => onSort("ctr")}>CTR <span className="sort-icon"><SortIcon col="ctr" /></span></th>}
      {visibleCols.has("cpc") && <th style={{ minWidth: 70 }} className={`sortable ${sortKey === "cpc" ? "sort-active" : ""}`} onClick={() => onSort("cpc")}>CPC <span className="sort-icon"><SortIcon col="cpc" /></span></th>}
      {visibleCols.has("conversions") && <th style={{ minWidth: 60 }} className={`sortable ${sortKey === "conversions" ? "sort-active" : ""}`} onClick={() => onSort("conversions")}>전환 <span className="sort-icon"><SortIcon col="conversions" /></span></th>}
      {visibleCols.has("cost") && <th style={{ minWidth: 80 }} className={`sortable ${sortKey === "cost" ? "sort-active" : ""}`} onClick={() => onSort("cost")}>비용 <span className="sort-icon"><SortIcon col="cost" /></span></th>}
    </tr>
  );
}

// ── 데이터 행 (공통) ─────────────────────────────────────────────
function TableRow({
  kw, selectedKws, visibleCols, editingBid, editBidValue, editingStrategy,
  onToggleRow, onBidClick, onBidChange, onBidSave, onBidCancel, onStrategyToggle, onStrategyChange,
  style,
}: {
  kw: KeywordRow;
  style?: React.CSSProperties;
} & Pick<KeywordTableProps,
  "selectedKws" | "visibleCols" | "editingBid" | "editBidValue" | "editingStrategy"
  | "onToggleRow" | "onBidClick" | "onBidChange" | "onBidSave" | "onBidCancel"
  | "onStrategyToggle" | "onStrategyChange"
>) {
  return (
    <tr style={{ background: selectedKws.has(kw.id) ? "var(--primary-light)" : undefined, ...style }}>
      <td><input type="checkbox" checked={selectedKws.has(kw.id)} onChange={() => onToggleRow(kw.id)} /></td>
      {visibleCols.has("text") && (
        <td className="keyword-sticky-col" style={{ fontWeight: 600 }} data-selected={selectedKws.has(kw.id) || undefined}>
          {kw.text}
          {kw.trend === "up"
            ? <TrendingUp size={14} color="var(--success)" style={{ marginLeft: 6 }} />
            : <TrendingDown size={14} color="var(--error)" style={{ marginLeft: 6 }} />}
        </td>
      )}
      {visibleCols.has("account") && <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{kw.account}</td>}
      {visibleCols.has("campaign") && <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{kw.campaign}</td>}
      {visibleCols.has("group") && <td style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>{kw.group}</td>}
      {visibleCols.has("bid") && (
        <td style={{ fontWeight: 600, cursor: "pointer" }} onClick={(e) => { e.stopPropagation(); onBidClick(kw.id, kw.bid); }}>
          {editingBid === kw.id ? (
            <input
              className="form-input" type="number" value={editBidValue}
              onChange={(e) => onBidChange(e.target.value)}
              onBlur={() => onBidSave(kw.id)}
              onKeyDown={(e) => { if (e.key === "Enter") onBidSave(kw.id); if (e.key === "Escape") onBidCancel(); }}
              autoFocus style={{ width: 80, padding: "2px 6px", fontSize: "0.857rem" }}
            />
          ) : (
            <>₩{kw.bid.toLocaleString()}</>
          )}
        </td>
      )}
      {visibleCols.has("rank") && (
        <td>
          <span className={`badge ${kw.rank <= 2 ? "badge-success" : kw.rank <= 4 ? "badge-warning" : "badge-error"}`}>
            {kw.rank}위
          </span>
        </td>
      )}
      {visibleCols.has("strategy") && (
        <td>
          <div className="strategy-dropdown">
            <span className="badge badge-info" style={{ cursor: "pointer" }} onClick={() => onStrategyToggle(kw.id)}>
              {strategyLabels[kw.strategy] ?? kw.strategy}
            </span>
            {editingStrategy === kw.id && (
              <div className="strategy-dropdown-menu">
                {Object.entries(strategyLabels).map(([key, label]) => (
                  <div key={key} className={`strategy-dropdown-item ${kw.strategy === key ? "active" : ""}`} onClick={() => onStrategyChange(kw.id, key)}>
                    {kw.strategy === key && <CheckCircle2 size={12} />} {label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </td>
      )}
      {visibleCols.has("qi") && (
        <td>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 2 }}>
            {"★".repeat(Math.min(kw.qi, 5))}
            <span style={{ fontSize: "0.714rem", color: "var(--text-muted)", marginLeft: 2 }}>{kw.qi}/10</span>
          </span>
        </td>
      )}
      {visibleCols.has("impressions") && <td>{kw.impressions.toLocaleString()}</td>}
      {visibleCols.has("clicks") && <td>{kw.clicks.toLocaleString()}</td>}
      {visibleCols.has("ctr") && <td>{kw.ctr}%</td>}
      {visibleCols.has("cpc") && <td>₩{kw.cpc.toLocaleString()}</td>}
      {visibleCols.has("conversions") && <td style={{ fontWeight: 600 }}>{kw.conversions}</td>}
      {visibleCols.has("cost") && <td>₩{kw.cost.toLocaleString()}</td>}
    </tr>
  );
}

// ── 가상 스크롤 내부 서브컴포넌트 ────────────────────────────────
// Hook을 최상위에서만 호출할 수 있도록 별도 컴포넌트로 분리
function VirtualKeywordTable(props: KeywordTableProps) {
  const tableRef = useRef<HTMLDivElement>(null); // ✅ 컴포넌트 최상위에서 훅 호출

  const rowVirtualizer = useVirtualizer({
    count: props.keywords.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => 52,
    overscan: 10,
  });

  const virtualItems = rowVirtualizer.getVirtualItems();

  return (
    <div className="virtual-table-container">
      <div className="virtual-table-header">
        <table style={{ tableLayout: "fixed" }}>
          <TableColgroup visibleCols={props.visibleCols} />
          <thead>
            <TableHeader
              keywords={props.keywords}
              selectedKws={props.selectedKws}
              visibleCols={props.visibleCols}
              sortKey={props.sortKey}
              sortDir={props.sortDir}
              onToggleAll={props.onToggleAll}
              onSort={props.onSort}
            />
          </thead>
        </table>
      </div>
      <div ref={tableRef} className="virtual-table-body" style={{ maxHeight: 600, overflowY: "auto" }}>
        <div style={{ height: rowVirtualizer.getTotalSize(), position: "relative" }}>
          <table style={{ position: "absolute", top: 0, left: 0, width: "100%", tableLayout: "fixed" }}>
            <TableColgroup visibleCols={props.visibleCols} />
            <tbody>
              {virtualItems.map((vRow) => {
                const kw = props.keywords[vRow.index];
                return (
                  <TableRow
                    key={kw.id}
                    kw={kw}
                    style={{
                      position: "absolute", top: 0, left: 0, width: "100%",
                      height: `${vRow.size}px`,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                    {...props}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <div className="virtual-table-footer">
        <span>총 {props.keywords.length.toLocaleString()}개 키워드</span>
        <span className="badge badge-info">가상 스크롤 활성</span>
      </div>
    </div>
  );
}

// ── 메인 Export: 50행 기준으로 일반/가상 스크롤 자동 선택 ──────
export default function KeywordTable(props: KeywordTableProps) {
  const useVirtual = props.keywords.length > 50;

  if (!useVirtual) {
    return (
      <div className="table-wrapper">
        <table style={{ tableLayout: "fixed" }}>
          <TableColgroup visibleCols={props.visibleCols} />
          <thead>
            <TableHeader
              keywords={props.keywords}
              selectedKws={props.selectedKws}
              visibleCols={props.visibleCols}
              sortKey={props.sortKey}
              sortDir={props.sortDir}
              onToggleAll={props.onToggleAll}
              onSort={props.onSort}
            />
          </thead>
          <tbody>
            {props.keywords.map((kw) => (
              <TableRow key={kw.id} kw={kw} {...props} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  return <VirtualKeywordTable {...props} />;
}
