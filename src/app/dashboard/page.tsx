"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Search, TrendingUp, TrendingDown, DollarSign,
  MousePointerClick, Eye, Target, Sparkles, ChevronRight,
  CheckCircle2, AlertTriangle, Calendar, RefreshCw
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useToast } from "@/components/Toast";
import { useDashboard, useAccounts, useAiActions, useHeatmap, apiMutate } from "@/hooks/useApi";
import { KpiSkeleton, TableSkeleton, ChartSkeleton } from "@/components/Skeleton";
import ErrorState from "@/components/ErrorState";
import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";
import Breadcrumb from "@/components/Breadcrumb";
import HeatmapChart, { type HeatmapCell } from "@/components/HeatmapChart";

const periods = ["오늘", "어제", "7일", "30일"] as const;
const periodMap: Record<string, string> = { "오늘": "today", "어제": "yesterday", "7일": "7d", "30일": "30d" };

// ── 폴백 Mock 데이터 (API 미연동 시 사용) ──
const fallbackKpi = [
  { label: "총 광고비", value: "₩45,230,000", change: "+12%", positive: true, icon: DollarSign, color: "#1E40AF" },
  { label: "평균 ROAS", value: "320%", change: "+18%", positive: true, icon: TrendingUp, color: "#10B981" },
  { label: "노출수", value: "312,000", change: "+7%", positive: true, icon: Eye, color: "#6366F1" },
  { label: "전환수", value: "485건", change: "+15%", positive: true, icon: Target, color: "#7C3AED" },
  { label: "총 클릭수", value: "48,200", change: "+8%", positive: true, icon: MousePointerClick, color: "#F59E0B" },
  { label: "활성 키워드", value: "2,847개", change: "+5%", positive: true, icon: Sparkles, color: "#EC4899" },
];

const fallbackChart = [
  { date: "3/6", roas: 280, cost: 5800000 }, { date: "3/7", roas: 310, cost: 6200000 },
  { date: "3/8", roas: 295, cost: 6100000 }, { date: "3/9", roas: 340, cost: 6500000 },
  { date: "3/10", roas: 320, cost: 6400000 }, { date: "3/11", roas: 350, cost: 7000000 },
  { date: "3/12", roas: 320, cost: 7230000 },
];

const fallbackAccounts = [
  { name: "A 법률사무소", status: "green", spend: "₩8,200,000", roas: "380%", keywords: 245, alert: null },
  { name: "B 성형외과", status: "red", spend: "₩12,500,000", roas: "210%", keywords: 523, alert: "CTR 50% 급락" },
  { name: "C 치과의원", status: "yellow", spend: "₩3,400,000", roas: "450%", keywords: 87, alert: "예산 90% 소진" },
  { name: "D 부동산", status: "green", spend: "₩6,100,000", roas: "290%", keywords: 312, alert: null },
  { name: "E 학원", status: "green", spend: "₩2,800,000", roas: "520%", keywords: 156, alert: null },
  { name: "F 인테리어", status: "yellow", spend: "₩5,700,000", roas: "260%", keywords: 198, alert: "CPC 상승 중" },
];

const fallbackAiActions = [
  { id: 1, account: "A 법률사무소", title: "'개인회생' 입찰가 15% 상향 제안", desc: "전환율이 상승 중입니다. 현재 순위 3위 → 1위 목표 달성 가능합니다.", type: "bid" },
  { id: 2, account: "B 성형외과", title: "저성과 키워드 3개 OFF 추천", desc: "'눈밑지방' 외 2개 키워드 CTR 0.3% 미만. 예산 재배분 시 ROAS +15% 예상.", type: "keyword" },
  { id: 3, account: "C 치과의원", title: "'임플란트 가격' 키워드 추가 추천", desc: "월간 검색량 12,100건. 경쟁도 낮음. 예상 CPC ₩480, 예상 전환 8건/월.", type: "add" },
  { id: 4, account: "E 학원", title: "오후 시간대 입찰가 강화 추천", desc: "15~18시 전환율이 평균 대비 2.3배 높습니다. 해당 시간대 입찰 +20% 권장.", type: "time" },
];

// ── 폴백 히트맵 데이터 (요일×시간) ──
const fallbackHeatmap: HeatmapCell[] = (() => {
  const dLabels = ['일', '월', '화', '수', '목', '금', '토'];
  const cells: HeatmapCell[] = [];
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      const isWork = h >= 9 && h <= 18;
      const isWd = d >= 1 && d <= 5;
      const base = isWork && isWd ? 80 : isWork ? 40 : 10;
      const clicks = base + Math.floor(Math.random() * 30);
      cells.push({
        day: d, dayLabel: dLabels[d], hour: h, hourLabel: `${h}시`,
        clicks, impressions: clicks * 15, cost: clicks * 450,
        conversions: Math.floor(clicks * 0.06), intensity: clicks,
      });
    }
  }
  return cells;
})();

// ── API 데이터를 KPI 포맷으로 변환 (증감률 포함) ──
function buildKpiFromApi(data: any): typeof fallbackKpi {
  if (!data?.kpi) return fallbackKpi;
  const k = data.kpi;
  return [
    { label: "총 광고비", value: `₩${(k.totalCost ?? 0).toLocaleString()}`, change: k.totalCostChange ?? "", positive: !k.totalCostChange?.startsWith('-'), icon: DollarSign, color: "#1E40AF" },
    { label: "평균 ROAS", value: `${k.avgRoas ?? 0}%`, change: k.avgRoasChange ?? "", positive: !k.avgRoasChange?.startsWith('-'), icon: TrendingUp, color: "#10B981" },
    { label: "노출수", value: (k.totalImpressions ?? 0).toLocaleString(), change: k.totalImpressionsChange ?? "", positive: !k.totalImpressionsChange?.startsWith('-'), icon: Eye, color: "#6366F1" },
    { label: "전환수", value: `${k.totalConversions ?? 0}건`, change: k.totalConversionsChange ?? "", positive: !k.totalConversionsChange?.startsWith('-'), icon: Target, color: "#7C3AED" },
    { label: "총 클릭수", value: (k.totalClicks ?? 0).toLocaleString(), change: k.totalClicksChange ?? "", positive: !k.totalClicksChange?.startsWith('-'), icon: MousePointerClick, color: "#F59E0B" },
    { label: "총 키워드", value: `${k.totalKeywords ?? 0}개`, change: "", positive: true, icon: Sparkles, color: "#EC4899" },
  ];
}

export default function DashboardPage() {
  const initRange = (): DateRange => {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const start = new Date(); start.setDate(start.getDate() - 6); start.setHours(0, 0, 0, 0);
    return { start, end };
  };
  const [dateRange, setDateRange] = useState<DateRange>(initRange);
  const [actionStates, setActionStates] = useState<Record<number, "approved" | "rejected" | "approved_dismissed" | "rejected_dismissed" | null>>({});
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();
  const { addToast } = useToast();

  // 날짜 범위 → 기간 문자열 변환
  const periodKey = useMemo(() => {
    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 1) return '1d';
    if (days <= 7) return '7d';
    if (days <= 30) return '30d';
    return '90d';
  }, [dateRange]);

  // ── API 데이터 페칭 (폴백 지원) ──
  const { data: dashboardData, isLoading: dashLoading, error: dashError, mutate: mutateDash } = useDashboard(periodKey);
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmap(periodKey);
  const [heatmapMetric, setHeatmapMetric] = useState<"clicks" | "impressions" | "cost" | "conversions">("clicks");
  const { data: accountsData, isLoading: accLoading } = useAccounts();
  const { data: aiActionsData, isLoading: aiLoading } = useAiActions();

  // API 데이터 or 폴백
  const kpiData = dashboardData ? buildKpiFromApi(dashboardData) : fallbackKpi;
  const chartData = dashboardData?.chartData ?? fallbackChart;
  const accounts: typeof fallbackAccounts = accountsData?.length > 0
    ? accountsData.map((a: any) => ({
        name: a.customerName || a.name || 'Unknown',
        status: a.connectionStatus === 'connected' ? 'green' : a.connectionStatus === 'error' ? 'red' : 'yellow',
        spend: `₩${(Number(a.totalCost ?? 0)).toLocaleString()}`,
        roas: `${a.roas ?? 0}%`,
        keywords: a._count?.keywords ?? 0,
        alert: null,
      }))
    : fallbackAccounts;
  const aiActions: typeof fallbackAiActions = aiActionsData?.length > 0
    ? aiActionsData.map((a: any, i: number) => ({
        id: a.id ?? i + 1,
        account: a.entityType ?? '',
        title: a.actionType ?? '',
        desc: a.outputData?.description ?? JSON.stringify(a.outputData ?? {}),
        type: a.actionType ?? 'bid',
      }))
    : fallbackAiActions;

  const filteredAccounts = accounts.filter((acc) =>
    searchQuery === "" || acc.name.toLowerCase().includes(searchQuery.toLowerCase())
  );
  const filteredAiActions = aiActions.filter((a) =>
    searchQuery === "" || a.account.toLowerCase().includes(searchQuery.toLowerCase()) || a.title.toLowerCase().includes(searchQuery.toLowerCase())
  );
  // dismissed 항목은 렌더에서 제외 (CSS 애니메이션 종료 후)
  const visibleAiActions = filteredAiActions.filter(
    (a) => !String(actionStates[a.id] ?? "").includes("_dismissed")
  );
  const pendingCount = filteredAiActions.filter((a) => !actionStates[a.id]).length;

  const handleAction = async (id: number, action: "approved" | "rejected") => {
    setActionStates((prev) => ({ ...prev, [id]: action }));
    const item = aiActions.find((a) => a.id === id);
    if (action === "approved") {
      addToast("success", "AI 추천 승인됨", `${item?.account} — ${item?.title}`);
    } else {
      addToast("info", "AI 추천 거부됨", `${item?.account} — ${item?.title}`);
    }
    // 2초 후 dismissed로 전환 → CSS 애니메이션 후 DOM에서 제거
    setTimeout(() => {
      setActionStates((prev) => ({ ...prev, [id]: `${action}_dismissed` as any }));
    }, 2000);
  };

  const handleBulkApprove = () => {
    const next = { ...actionStates };
    let count = 0;
    aiActions.forEach((a) => { if (!next[a.id]) { next[a.id] = "approved"; count++; } });
    setActionStates(next);
    addToast("success", `${count}건 AI 추천 일괄 승인`, "선택된 모든 추천이 적용되었습니다.");
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">대시보드</h1>
        <div className="main-header-actions">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <div style={{ position: "relative" }}>
            <Search size={18} color="var(--text-muted)" style={{ position: "absolute", left: 12, top: 10 }} />
            <input className="form-input" placeholder="계정/키워드 검색..." style={{ paddingLeft: 36, width: 200 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <button className="btn btn-ghost" style={{ position: "relative" }} onClick={() => router.push("/dashboard/notifications")}>
            <Bell size={20} />
            <span style={{ position: "absolute", top: 2, right: 2, width: 8, height: 8, background: "var(--error)", borderRadius: "50%" }} />
          </button>
        </div>
      </header>

      <div className="main-body">
        {/* KPI Cards */}
        {dashLoading ? (
          <KpiSkeleton count={6} />
        ) : dashError ? (
          <ErrorState message="KPI 데이터를 불러올 수 없습니다." onRetry={() => mutateDash()} />
        ) : (
          <div className="kpi-grid">
            {kpiData.map((kpi, idx) => {
              const Icon = kpi.icon;
              const drillDownRoutes = [
                "/dashboard/accounts",
                "/dashboard/campaigns",
                "/dashboard/keywords",
                "/dashboard/keywords",
                "/dashboard/keywords",
                "/dashboard/notifications",
              ];
              return (
                <div className="kpi-card" key={kpi.label} onClick={() => router.push(drillDownRoutes[idx])} title={`${kpi.label} 상세 보기`}>
                  <div className="kpi-card-icon" style={{ background: `${kpi.color}15`, color: kpi.color }}>
                    <Icon size={20} />
                  </div>
                  <div className="kpi-card-label">{kpi.label}</div>
                  <div className="kpi-card-value">{kpi.value}</div>
                  {kpi.change && (
                    <span className={`kpi-card-change ${kpi.positive ? "positive" : "negative"}`}>
                      {kpi.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                      {kpi.change}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* AI Recommend Panel */}
        <div className="card ai-panel" style={{ marginBottom: "var(--space-6)" }}>
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sparkles size={20} color="var(--primary)" />
              AI 추천 액션
              <span className="badge badge-info">{pendingCount}건 대기</span>
            </h3>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-success btn-sm" onClick={handleBulkApprove} disabled={pendingCount === 0}>
                <CheckCircle2 size={14} /> 전체 승인
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => router.push("/dashboard/copilot")}>AI 코파일럿에서 분석 →</button>
            </div>
          </div>
          <div style={{ padding: 0, overflow: "hidden" }}>
            {visibleAiActions.map((action) => {
              const state = actionStates[action.id];
              return (
                <div className={`ai-action-item${state === "approved" || state === "rejected" ? " dismissed" : ""}`} key={action.id} style={{ opacity: state ? 0.5 : 1 }}>
                  <div className="ai-action-icon">
                    <Sparkles size={16} />
                  </div>
                  <div className="ai-action-content">
                    <div className="ai-action-title">
                      <span className="badge badge-info" style={{ marginRight: 8, fontSize: "0.714rem" }}>{action.account}</span>
                      {action.title}
                    </div>
                    <div className="ai-action-desc">{action.desc}</div>
                  </div>
                  <div style={{ display: "flex", gap: 4, flexShrink: 0 }}>
                    {state === "approved" ? (
                      <span className="badge badge-success">✅ 승인됨</span>
                    ) : state === "rejected" ? (
                      <span className="badge badge-error">❌ 거부됨</span>
                    ) : (
                      <>
                        <button className="btn btn-primary btn-sm" onClick={() => handleAction(action.id, "approved")}>승인</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleAction(action.id, "rejected")}>거부</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="grid-2">
          {/* Account Status */}
          {accLoading ? (
            <TableSkeleton rows={6} cols={5} />
          ) : (
            <div className="card">
              <div className="card-header">
                <h3>계정 현황</h3>
                <div style={{ display: "flex", gap: 12, fontSize: "0.857rem" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span className="status-dot green" /> 정상 {accounts.filter(a => a.status === 'green').length}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span className="status-dot yellow" /> 주의 {accounts.filter(a => a.status === 'yellow').length}</span>
                  <span style={{ display: "flex", alignItems: "center", gap: 4 }}><span className="status-dot red" /> 긴급 {accounts.filter(a => a.status === 'red').length}</span>
                </div>
              </div>
              <div className="card-body" style={{ padding: 0 }}>
                <table>
                  <thead>
                    <tr><th>계정</th><th>상태</th><th>광고비</th><th>ROAS</th><th>키워드</th><th></th></tr>
                  </thead>
                  <tbody>
                    {filteredAccounts.map((acc) => (
                      <tr key={acc.name} onClick={() => router.push(`/dashboard/campaigns?account=${encodeURIComponent(acc.name)}`)} style={{ cursor: "pointer" }}>
                        <td style={{ fontWeight: 600 }}>{acc.name}</td>
                        <td>
                          <span className="status-dot" style={{ background: acc.status === "green" ? "var(--success)" : acc.status === "yellow" ? "var(--warning)" : "var(--error)" }} />
                          {acc.alert && <span style={{ marginLeft: 8, fontSize: "0.786rem", color: acc.status === "red" ? "var(--error)" : "var(--warning)" }}>{acc.alert}</span>}
                        </td>
                        <td>{acc.spend}</td>
                        <td style={{ fontWeight: 600 }}>{acc.roas}</td>
                        <td>{acc.keywords}개</td>
                        <td><ChevronRight size={16} color="var(--text-muted)" /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ROAS Chart */}
          {dashLoading ? (
            <ChartSkeleton height={260} />
          ) : (
            <div className="card">
              <div className="card-header">
                <h3>일별 ROAS 추이 ({periodKey})</h3>
              </div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="roasGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#1E40AF" stopOpacity={0.15} />
                        <stop offset="100%" stopColor="#1E40AF" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis stroke="var(--text-muted)" fontSize={12} unit="%" />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-lg)" }}
                      formatter={(value) => [`${value}%`, "ROAS"]}
                    />
                    <Area type="monotone" dataKey="roas" stroke="#1E40AF" strokeWidth={2.5} fill="url(#roasGrad)" dot={{ r: 4, fill: "#1E40AF" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          {/* 시간대별 성과 히트맵 */}
          <div className="card">
            <div className="card-header">
              <h3>⏰ 시간대별 성과 히트맵</h3>
              <div className="flex-center gap-2">
                {(["clicks", "impressions", "cost", "conversions"] as const).map((m) => (
                  <button
                    key={m}
                    className={`btn btn-sm ${heatmapMetric === m ? "btn-primary" : "btn-ghost"}`}
                    onClick={() => setHeatmapMetric(m)}
                  >
                    {{ clicks: "클릭", impressions: "노출", cost: "비용", conversions: "전환" }[m]}
                  </button>
                ))}
              </div>
            </div>
            <div className="card-body">
              {heatmapLoading ? (
                <ChartSkeleton height={220} />
              ) : (
                <HeatmapChart
                  data={heatmapData?.data ?? fallbackHeatmap}
                  metric={heatmapMetric}
                />
              )}
            </div>
          </div>
        </div>

        {/* Data Reconciliation Status Bar */}
        <div style={{
          marginTop: 16, padding: "10px 16px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.786rem", color: "var(--text-muted)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <CheckCircle2 size={14} color="var(--success)" />
            <span>
              마지막 정합성 검증: {dashboardData?.lastSyncedAt
                ? new Date(dashboardData.lastSyncedAt).toLocaleString("ko-KR")
                : new Date().toLocaleDateString("ko-KR")}
              {" "}{dashboardData ? "✅ API 연결됨" : "⚠️ 폴백 모드"}
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <span><RefreshCw size={12} style={{ verticalAlign: "middle", marginRight: 4 }} />데이터 동기화: {dashboardData ? "실시간" : "미연결"}</span>
          </div>
        </div>
      </div>
    </>
  );
}
