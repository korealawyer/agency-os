"use client";

import { useState, useMemo, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Bell, Search, TrendingUp, TrendingDown, DollarSign,
  MousePointerClick, Eye, Target, Sparkles, ChevronRight,
  CheckCircle2, AlertTriangle, Calendar, RefreshCw, X, Wifi, FileText
} from "lucide-react";
import {
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area,
} from "recharts";
import { useToast } from "@/components/Toast";
import ErrorState from "@/components/ErrorState";
import { useDashboard, useAccounts, useAiActions, useHeatmap, apiMutate } from "@/hooks/useApi";
import { KpiSkeleton, TableSkeleton, ChartSkeleton } from "@/components/Skeleton";

import DateRangePicker, { type DateRange } from "@/components/DateRangePicker";
import Breadcrumb from "@/components/Breadcrumb";
import HeatmapChart, { type HeatmapCell } from "@/components/HeatmapChart";

const periods = ["오늘", "어제", "7일", "30일"] as const;
const periodMap: Record<string, string> = { "오늘": "today", "어제": "yesterday", "7일": "7d", "30일": "30d" };

// ── 빈 기본값 (데이터 없을 때 사용) ──
const emptyKpi = [
  { label: "총 광고비", value: "₩0", change: "", positive: true, icon: DollarSign, color: "#1E40AF" },
  { label: "평균 ROAS", value: "0%", change: "", positive: true, icon: TrendingUp, color: "#10B981" },
  { label: "노출수", value: "0", change: "", positive: true, icon: Eye, color: "#6366F1" },
  { label: "전환수", value: "0건", change: "", positive: true, icon: Target, color: "#7C3AED" },
  { label: "총 클릭수", value: "0", change: "", positive: true, icon: MousePointerClick, color: "#F59E0B" },
  { label: "활성 키워드", value: "0개", change: "", positive: true, icon: Sparkles, color: "#EC4899" },
];

type AccountRow = { name: string; status: string; spend: string; roas: string; keywords: number; alert: string | null };
type AiAction = { id: number; account: string; title: string; desc: string; type: string };

// ── API 데이터를 KPI 포맷으로 변환 (증감률 포함) ──
function buildKpiFromApi(data: any): typeof emptyKpi {
  if (!data?.kpi) return emptyKpi;
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
  const [showBellPanel, setShowBellPanel] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { addToast } = useToast();

  // 알림 빠른 미리보기 데이터
  const quickNotifs = [
    { id: 2, icon: AlertTriangle, color: "var(--error)", title: "B 성형외과 CTR 급락", time: "12분 전", href: "/dashboard/campaigns?account=B%20%EC%84%B1%ED%98%95%EC%99%B8%EA%B3%BC" },
    { id: 4, icon: AlertTriangle, color: "var(--warning)", title: "C 치과의원 일예산 90% 소진", time: "2시간 전", href: "/dashboard/accounts" },
    { id: 5, icon: Wifi, color: "var(--error)", title: "D 부동산 API 연결 오류", time: "3시간 전", href: "/dashboard/accounts" },
    { id: 3, icon: FileText, color: "var(--success)", title: "주간 리포트 발송 완료", time: "1시간 전", href: "/dashboard/reports" },
    { id: 1, icon: TrendingUp, color: "var(--warning)", title: "A 법률사무소 입찰가 조정", time: "5분 전", href: "/dashboard/keywords" },
  ];

  // Bell panel 외부 클릭 시 닫기
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowBellPanel(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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
  // API 에러 여부 (단, 이전 캐시 데이터가 있으면 표시 유지)
  const hasApiError = !!dashError && !dashboardData;
  const { data: heatmapData, isLoading: heatmapLoading } = useHeatmap(periodKey);
  const [heatmapMetric, setHeatmapMetric] = useState<"clicks" | "impressions" | "cost" | "conversions">("clicks");
  const { data: accountsData, isLoading: accLoading } = useAccounts();
  const { data: aiActionsData, isLoading: aiLoading } = useAiActions();

  // API 데이터 — 데이터 없으면 빈 상태 표시 (폴백 샘플 데이터 사용 안 함)
  const kpiData = dashboardData ? buildKpiFromApi(dashboardData) : emptyKpi;
  const hasData = !!dashboardData; // 실제 데이터 존재 여부
  const chartData = dashboardData?.chartData ?? [];
  const accounts: AccountRow[] = accountsData?.length > 0
    ? accountsData.map((a: any) => ({
        name: a.customerName || a.name || 'Unknown',
        status: a.connectionStatus === 'connected' ? 'green' : a.connectionStatus === 'error' ? 'red' : 'yellow',
        spend: `₩${(Number(a.totalCost ?? 0)).toLocaleString()}`,
        roas: `${a.roas ?? 0}%`,
        keywords: a._count?.keywords ?? 0,
        alert: null,
      }))
    : [];
  const aiActions: AiAction[] = aiActionsData?.length > 0
    ? aiActionsData.map((a: any, i: number) => ({
        id: a.id ?? i + 1,
        account: a.entityType ?? '',
        title: a.actionType ?? '',
        desc: a.outputData?.description ?? JSON.stringify(a.outputData ?? {}),
        type: a.actionType ?? 'bid',
      }))
    : [];

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
          <DateRangePicker value={dateRange} onChange={(range) => {
            setDateRange(range);
            const days = Math.round((range.end.getTime() - range.start.getTime()) / (1000 * 60 * 60 * 24));
            addToast("info", "기간 변경", `최근 ${days || 1}일 데이터로 전환됩니다.`);
          }} />
          <div style={{ position: "relative" }}>
            <Search size={18} color="var(--text-muted)" style={{ position: "absolute", left: 12, top: 10 }} />
            <input className="form-input" placeholder="계정/키워드 검색..." style={{ paddingLeft: 36, width: 200 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <div ref={bellRef} style={{ position: "relative" }}>
            <button className="btn btn-ghost" style={{ position: "relative", width: 40, height: 40, padding: 0, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={() => setShowBellPanel((v) => !v)} aria-label="알림">
              <Bell size={20} />
              <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, background: "var(--error)", borderRadius: "50%" }} />
            </button>
            {showBellPanel && (
              <div style={{
                position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 200,
                background: "var(--bg-card, var(--surface))", border: "1px solid var(--border)",
                borderRadius: "var(--radius-xl)", boxShadow: "var(--shadow-xl)",
                minWidth: 320, maxWidth: 380, overflow: "hidden",
              }}>
                <div style={{ padding: "12px 16px", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "0.929rem" }}>🔔 알림</strong>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span className="badge badge-error" style={{ fontSize: "0.714rem" }}>3 미읽음</span>
                    <button className="btn btn-ghost btn-sm" onClick={() => setShowBellPanel(false)}><X size={14} /></button>
                  </div>
                </div>
                <div style={{ maxHeight: 340, overflowY: "auto" }}>
                  {quickNotifs.map((n) => {
                    const Icon = n.icon;
                    return (
                      <div
                        key={n.id}
                        onClick={() => { setShowBellPanel(false); router.push(n.href); }}
                        style={{
                          display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 16px",
                          borderBottom: "1px solid var(--border)", cursor: "pointer",
                          transition: "background var(--transition)",
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = "var(--surface-hover)"}
                        onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                      >
                        <div style={{ width: 28, height: 28, borderRadius: "var(--radius-md)", background: `${n.color}20`, color: n.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 }}>
                          <Icon size={14} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: "0.857rem", fontWeight: 600, color: "var(--text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.title}</div>
                          <div style={{ fontSize: "0.786rem", color: "var(--text-muted)", marginTop: 1 }}>{n.time}</div>
                        </div>
                        <ChevronRight size={14} color="var(--text-muted)" style={{ flexShrink: 0, marginTop: 4 }} />
                      </div>
                    );
                  })}
                </div>
                <div style={{ padding: "10px 16px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
                  <button className="btn btn-ghost btn-sm" style={{ width: "100%", fontSize: "0.857rem" }} onClick={() => { setShowBellPanel(false); router.push("/dashboard/notifications"); }}>
                    전체 알림 보기 →
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="main-body">
        {/* API 에러 배너 — 캐시 데이터도 없을 때만 표시 */}
        {dashError && (
          <div style={{
            marginBottom: 16, padding: '10px 16px',
            background: 'var(--warning-light, #FEF9C3)', border: '1px solid var(--warning, #F59E0B)',
            borderRadius: 'var(--radius-lg)', display: 'flex', alignItems: 'center', gap: 10,
            fontSize: '0.857rem', color: 'var(--warning-dark, #92400E)',
          }}>
            <AlertTriangle size={16} color="var(--warning, #F59E0B)" />
            <span style={{ flex: 1 }}>
              {hasApiError
                ? '실시간 데이터를 불러올 수 없습니다. 계정을 연동하면 데이터가 표시됩니다.'
                : '⚠️ API 불안정 — 이전 데이터를 표시 중입니다.'}
            </span>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => mutateDash()}
              style={{ flexShrink: 0, color: 'var(--warning-dark, #92400E)' }}
            >
              <RefreshCw size={13} style={{ marginRight: 4 }} /> 재시도
            </button>
          </div>
        )}

        {/* KPI Cards */}
        {dashLoading && hasData ? (
          <KpiSkeleton count={6} />
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
            {visibleAiActions.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.929rem' }}>
                <Sparkles size={32} color="var(--border)" style={{ marginBottom: 12 }} />
                <div>AI 추천 액션이 없습니다</div>
                <div style={{ fontSize: '0.786rem', marginTop: 4 }}>광고 계정을 연동하면 AI가 최적화 제안을 제공합니다</div>
              </div>
            ) : visibleAiActions.map((action) => {
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
                {filteredAccounts.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.929rem' }}>
                    <Target size={32} color="var(--border)" style={{ marginBottom: 12 }} />
                    <div>연동된 광고 계정이 없습니다</div>
                    <div style={{ fontSize: '0.786rem', marginTop: 4 }}>계정 관리에서 네이버 광고 계정을 연동하세요</div>
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => router.push('/dashboard/accounts')}>계정 연동하기</button>
                  </div>
                ) : (
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
                )}
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
                {chartData.length === 0 ? (
                  <div style={{ height: 260, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.929rem' }}>
                    <TrendingUp size={32} color="var(--border)" style={{ marginBottom: 12 }} />
                    <div>차트 데이터가 없습니다</div>
                    <div style={{ fontSize: '0.786rem', marginTop: 4 }}>광고 데이터가 수집되면 ROAS 추이가 표시됩니다</div>
                  </div>
                ) : (
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
                )}
              </div>
            </div>
          )}

        </div>

        {/* 시간대별 성과 히트맵 — 전체 너비 */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header">
            <h3>⏰ 시간대별 성과 히트맵</h3>
            <div className="flex-center">
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
            ) : !heatmapData?.data?.length || heatmapData.data.every((c: any) => c[heatmapMetric] === 0) ? (
              <div style={{ height: 220, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.929rem' }}>
                <span style={{ fontSize: 32, marginBottom: 12 }}>🕐</span>
                <div>시간대별 성과 데이터가 없습니다</div>
                <div style={{ fontSize: '0.786rem', marginTop: 4 }}>광고 데이터가 수집되면 요일·시간대별 성과 패턴이 표시됩니다</div>
              </div>
            ) : (
              <HeatmapChart
                data={heatmapData?.data ?? []}
                metric={heatmapMetric}
              />
            )}
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
              {" "}{dashboardData ? "✅ API 연결됨" : "⚠️ 데이터 없음"}
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
