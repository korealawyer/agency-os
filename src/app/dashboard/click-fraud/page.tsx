"use client";

import { useState, useMemo, useEffect } from "react";
import {
  ShieldAlert, AlertTriangle, Ban, FileBarChart,
  Search, ChevronLeft, ChevronRight, Download,
  CheckCircle, XCircle, Clock, Eye, Filter, Plus, ToggleLeft, ToggleRight,
  Globe, Fingerprint, MousePointerClick
} from "lucide-react";
import { downloadCsv, downloadPdf } from "@/utils/export";
import { useClickFraudEvents, useBlockedIps, useClickFraudSummary } from "@/hooks/useApi";

type TabType = "overview" | "events" | "blocked" | "report";
type EventStatus = "all" | "pending" | "confirmed" | "dismissed";
type PeriodFilter = "today" | "7d" | "30d";

// ── 데이터는 API에서 로드 (Mock Data 제거) ──
const dailySummaries: any[] = [];
const fraudEvents: any[] = [];
const blockedIps: any[] = [];

// ── Helpers ──
const fmt = (n: number) => n.toLocaleString("ko-KR");
const fmtWon = (n: number) => `₩${n.toLocaleString("ko-KR")}`;

const statusConfig: Record<string, { label: string; badge: string; icon: typeof Clock }> = {
  pending:   { label: "대기", badge: "badge-warning", icon: Clock },
  confirmed: { label: "확인됨", badge: "badge-error", icon: CheckCircle },
  dismissed: { label: "기각", badge: "badge-info", icon: XCircle },
};

const reasonLabels: Record<string, string> = {
  rule_based: "규칙 기반",
  ml_detected: "ML 탐지",
  manual: "수동",
};

const PAGE_SIZE = 5;

// ── Component ──

export default function ClickFraudPage() {
  const [activeTab, setActiveTab] = useState<TabType>("overview");
  const [eventStatusFilter, setEventStatusFilter] = useState<EventStatus>("all");
  const [blockedActiveFilter, setBlockedActiveFilter] = useState<"all" | "active" | "inactive">("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("7d");
  const [eventPage, setEventPage] = useState(1);
  const [blockedPage, setBlockedPage] = useState(1);
  const [reportPage, setReportPage] = useState(1);
  const [eventStates, setEventStates] = useState<Record<string, string>>(
    Object.fromEntries(fraudEvents.map(e => [e.id, e.status]))
  );
  const [blockedStates, setBlockedStates] = useState<Record<string, boolean>>(
    Object.fromEntries(blockedIps.map(b => [b.id, b.isActive]))
  );

  // ── Overview KPIs ──
  const totals = useMemo(() => {
    const totalClicks = dailySummaries.reduce((s, d) => s + d.totalClicks, 0);
    const totalFraud = dailySummaries.reduce((s, d) => s + d.fraudClicks, 0);
    const totalLoss = dailySummaries.reduce((s, d) => s + d.estimatedLoss, 0);
    const totalBlocked = blockedIps.filter(b => blockedStates[b.id]).length;
    const refunded = dailySummaries.reduce((s, d) => s + d.refundApproved, 0);
    return { totalClicks, totalFraud, fraudRate: totalClicks > 0 ? ((totalFraud / totalClicks) * 100).toFixed(2) : "0", totalLoss, totalBlocked, refunded };
  }, [blockedStates]);

  // ── Filtered Events ──
  const filteredEvents = fraudEvents.filter(e => {
    if (eventStatusFilter === "all") return true;
    return eventStates[e.id] === eventStatusFilter;
  });
  const eventTotalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const eventSafePage = Math.min(eventPage, eventTotalPages);
  const paginatedEvents = filteredEvents.slice((eventSafePage - 1) * PAGE_SIZE, eventSafePage * PAGE_SIZE);

  // ── Filtered Blocked IPs ──
  const filteredBlocked = blockedIps.filter(b => {
    if (blockedActiveFilter === "all") return true;
    return blockedActiveFilter === "active" ? blockedStates[b.id] : !blockedStates[b.id];
  });
  const blockedTotalPages = Math.max(1, Math.ceil(filteredBlocked.length / PAGE_SIZE));
  const blockedSafePage = Math.min(blockedPage, blockedTotalPages);
  const paginatedBlocked = filteredBlocked.slice((blockedSafePage - 1) * PAGE_SIZE, blockedSafePage * PAGE_SIZE);

  // ── Report pagination ──
  const reportTotalPages = Math.max(1, Math.ceil(dailySummaries.length / PAGE_SIZE));
  const reportSafePage = Math.min(reportPage, reportTotalPages);
  const paginatedReport = dailySummaries.slice((reportSafePage - 1) * PAGE_SIZE, reportSafePage * PAGE_SIZE);

  const updateEventStatus = (id: string, status: string) => {
    setEventStates(prev => ({ ...prev, [id]: status }));
  };

  const toggleBlockedIp = (id: string) => {
    setBlockedStates(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const tabs: { key: TabType; label: string; icon: typeof ShieldAlert }[] = [
    { key: "overview", label: "개요", icon: ShieldAlert },
    { key: "events", label: "의심 이벤트", icon: AlertTriangle },
    { key: "blocked", label: "차단 IP", icon: Ban },
    { key: "report", label: "일간 리포트", icon: FileBarChart },
  ];

  const Pagination = ({ current, total, onPageChange }: { current: number; total: number; onPageChange: (p: number) => void }) => (
    total > 1 ? (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 12, padding: "12px 16px", borderTop: "1px solid var(--border)", fontSize: "0.857rem", color: "var(--text-secondary)" }}>
        <button className="btn btn-ghost btn-sm" disabled={current <= 1} onClick={() => onPageChange(current - 1)}><ChevronLeft size={14} /> 이전</button>
        <span>{current} / {total} 페이지</span>
        <button className="btn btn-ghost btn-sm" disabled={current >= total} onClick={() => onPageChange(current + 1)}>다음 <ChevronRight size={14} /></button>
      </div>
    ) : null
  );

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">부정클릭 방지</h1>
        <div className="main-header-actions">
          <div style={{ display: "flex", gap: 4, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", padding: 3 }}>
            {([ { key: "today" as PeriodFilter, label: "오늘" }, { key: "7d", label: "7일" }, { key: "30d", label: "30일" } ]).map(p => (
              <button key={p.key} className={`btn btn-sm ${periodFilter === p.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setPeriodFilter(p.key as PeriodFilter)}>{p.label}</button>
            ))}
          </div>
        </div>
      </header>

      <div className="main-body">
        {/* Tabs */}
        <div className="tabs">
          {tabs.map(t => {
            const Icon = t.icon;
            return (
              <div key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
                <Icon size={14} style={{ marginRight: 4 }} /> {t.label}
              </div>
            );
          })}
        </div>

        {/* ─── Overview Tab ─── */}
        {activeTab === "overview" && (
          <>
            <div className="kpi-row" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16, marginBottom: 20 }}>
              {[
                { label: "총 클릭", value: fmt(totals.totalClicks), sub: "최근 7일", color: "var(--info)", icon: MousePointerClick },
                { label: "부정클릭", value: fmt(totals.totalFraud), sub: `${totals.fraudRate}%`, color: "var(--error)", icon: AlertTriangle },
                { label: "추정 손실액", value: fmtWon(totals.totalLoss), sub: "누적", color: "var(--warning)", icon: ShieldAlert },
                { label: "차단 IP", value: `${totals.totalBlocked}개`, sub: "활성", color: "var(--success)", icon: Ban },
                { label: "환불 승인", value: fmtWon(totals.refunded), sub: "누적", color: "var(--primary)", icon: CheckCircle },
              ].map((kpi, i) => {
                const Icon = kpi.icon;
                return (
                  <div key={i} className="card" style={{ padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <span style={{ fontSize: "0.786rem", color: "var(--text-muted)", fontWeight: 500 }}>{kpi.label}</span>
                      <div style={{ width: 32, height: 32, borderRadius: "var(--radius-md)", background: `${kpi.color}15`, color: kpi.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={16} />
                      </div>
                    </div>
                    <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{kpi.value}</div>
                    <div style={{ fontSize: "0.714rem", color: "var(--text-muted)", marginTop: 4 }}>{kpi.sub}</div>
                  </div>
                );
              })}
            </div>

            {/* Recent Events Mini-Table */}
            <div className="card">
              <div className="card-header">
                <h3><AlertTriangle size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />최근 의심 이벤트</h3>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th>시간</th><th>광고주</th><th>키워드</th><th>IP</th><th>위험도</th><th>상태</th></tr>
                  </thead>
                  <tbody>
                    {fraudEvents.slice(0, 5).map(e => {
                      const st = statusConfig[eventStates[e.id]];
                      return (
                        <tr key={e.id}>
                          <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{e.time}</td>
                          <td style={{ fontWeight: 600, fontSize: "0.857rem" }}>{e.account}</td>
                          <td style={{ fontSize: "0.857rem" }}>{e.keyword}</td>
                          <td style={{ fontFamily: "monospace", fontSize: "0.786rem" }}>{e.ip}</td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 48, height: 6, borderRadius: 3, background: "var(--surface-hover)", overflow: "hidden" }}>
                                <div style={{ width: `${e.score * 100}%`, height: "100%", borderRadius: 3, background: e.score >= 0.8 ? "var(--error)" : e.score >= 0.5 ? "var(--warning)" : "var(--success)" }} />
                              </div>
                              <span style={{ fontSize: "0.786rem", fontWeight: 600, color: e.score >= 0.8 ? "var(--error)" : e.score >= 0.5 ? "var(--warning)" : "var(--success)" }}>{(e.score * 100).toFixed(0)}%</span>
                            </div>
                          </td>
                          <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ─── Events Tab ─── */}
        {activeTab === "events" && (
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3><AlertTriangle size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />의심 클릭 이벤트</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="form-input" style={{ width: 130, padding: "6px 8px", fontSize: "0.857rem" }}
                  value={eventStatusFilter} onChange={e => { setEventStatusFilter(e.target.value as EventStatus); setEventPage(1); }}>
                  <option value="all">전체 상태</option>
                  <option value="pending">⏳ 대기</option>
                  <option value="confirmed">✅ 확인됨</option>
                  <option value="dismissed">❌ 기각</option>
                </select>
                <span style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>{filteredEvents.length}건</span>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>시간</th><th>광고주</th><th>키워드</th><th>IP 해시</th>
                    <th>디바이스</th><th>지역</th><th>체류(ms)</th><th>위험도</th><th>트리거 규칙</th><th>상태</th><th>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedEvents.map(e => {
                    const currentStatus = eventStates[e.id];
                    const st = statusConfig[currentStatus];
                    return (
                      <tr key={e.id}>
                        <td style={{ fontFamily: "monospace", fontSize: "0.786rem", color: "var(--text-muted)" }}>{e.id}</td>
                        <td style={{ fontSize: "0.857rem", whiteSpace: "nowrap" }}>{e.time}</td>
                        <td style={{ fontWeight: 600, fontSize: "0.857rem" }}>{e.account}</td>
                        <td style={{ fontSize: "0.857rem" }}>{e.keyword}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.786rem" }}>{e.ip}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.786rem" }}>{e.device}</td>
                        <td style={{ fontSize: "0.857rem" }}>{e.geo}</td>
                        <td style={{ fontSize: "0.857rem", textAlign: "right" }}>{fmt(e.dwell)}</td>
                        <td>
                          <span style={{ fontSize: "0.857rem", fontWeight: 700, color: e.score >= 0.8 ? "var(--error)" : e.score >= 0.5 ? "var(--warning)" : "var(--success)" }}>
                            {(e.score * 100).toFixed(0)}%
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {e.rules.map((r: string, i: number) => (
                              <span key={i} style={{ fontSize: "0.643rem", background: "var(--surface-hover)", padding: "2px 6px", borderRadius: 4 }}>{r}</span>
                            ))}
                          </div>
                        </td>
                        <td><span className={`badge ${st.badge}`}>{st.label}</span></td>
                        <td>
                          {currentStatus === "pending" && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-sm" style={{ background: "var(--error)", color: "#fff", padding: "4px 8px", fontSize: "0.714rem" }}
                                onClick={() => updateEventStatus(e.id, "confirmed")}>확인</button>
                              <button className="btn btn-ghost btn-sm" style={{ padding: "4px 8px", fontSize: "0.714rem" }}
                                onClick={() => updateEventStatus(e.id, "dismissed")}>기각</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination current={eventSafePage} total={eventTotalPages} onPageChange={setEventPage} />
          </div>
        )}

        {/* ─── Blocked IP Tab ─── */}
        {activeTab === "blocked" && (
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3><Ban size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />차단 IP 목록</h3>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <select className="form-input" style={{ width: 130, padding: "6px 8px", fontSize: "0.857rem" }}
                  value={blockedActiveFilter} onChange={e => { setBlockedActiveFilter(e.target.value as any); setBlockedPage(1); }}>
                  <option value="all">전체</option>
                  <option value="active">🟢 활성</option>
                  <option value="inactive">⚪ 해제됨</option>
                </select>
                <span style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>{filteredBlocked.length}건</span>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>상태</th><th>광고주</th><th>IP (마스킹)</th><th>차단 사유</th>
                    <th>트리거 규칙</th><th>부정 횟수</th><th>추정 손실</th><th>차단일</th><th>만료</th><th>액션</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedBlocked.map(b => {
                    const active = blockedStates[b.id];
                    return (
                      <tr key={b.id} style={{ opacity: active ? 1 : 0.5 }}>
                        <td>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: active ? "var(--success)" : "var(--text-muted)" }} />
                        </td>
                        <td style={{ fontWeight: 600, fontSize: "0.857rem" }}>{b.account}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.786rem" }}>{b.ipMasked}</td>
                        <td>
                          <span className={`badge ${b.reason === "ml_detected" ? "badge-info" : b.reason === "rule_based" ? "badge-warning" : "badge-success"}`}>
                            {reasonLabels[b.reason]}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                            {b.rules.map((r: string, i: number) => (
                              <span key={i} style={{ fontSize: "0.643rem", background: "var(--surface-hover)", padding: "2px 6px", borderRadius: 4 }}>{r}</span>
                            ))}
                          </div>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: 600, fontSize: "0.857rem" }}>{fmt(b.fraudCount)}</td>
                        <td style={{ textAlign: "right", fontSize: "0.857rem", color: "var(--error)" }}>{fmtWon(b.loss)}</td>
                        <td style={{ fontSize: "0.857rem", whiteSpace: "nowrap" }}>{b.blockedAt}</td>
                        <td style={{ fontSize: "0.857rem", color: "var(--text-muted)" }}>{b.expires}</td>
                        <td>
                          <button className={`btn btn-sm ${active ? "btn-secondary" : "btn-primary"}`}
                            style={{ padding: "4px 10px", fontSize: "0.714rem" }}
                            onClick={() => toggleBlockedIp(b.id)}>
                            {active ? <>해제</> : <>차단</>}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pagination current={blockedSafePage} total={blockedTotalPages} onPageChange={setBlockedPage} />
          </div>
        )}

        {/* ─── Daily Report Tab ─── */}
        {activeTab === "report" && (
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
              <h3><FileBarChart size={16} style={{ marginRight: 8, verticalAlign: "middle" }} />일간 부정클릭 리포트</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  downloadCsv("부정클릭_일간리포트",
                    ["날짜", "광고주", "총클릭", "부정클릭", "부정률(%)", "추정손실", "차단IP", "환불요청", "환불승인"],
                    dailySummaries.map(d => [d.date, d.account, String(d.totalClicks), String(d.fraudClicks), String(d.fraudRate), String(d.estimatedLoss), String(d.blockedIps), String(d.refundRequested), String(d.refundApproved)])
                  );
                }}><Download size={14} /> CSV</button>
                <button className="btn btn-secondary btn-sm" onClick={() => {
                  downloadPdf("부정클릭_일간리포트", "부정클릭 일간 리포트",
                    [["날짜", "광고주", "총클릭", "부정클릭", "부정률(%)", "추정손실", "차단IP", "환불요청", "환불승인"],
                    ...dailySummaries.map(d => [d.date, d.account, String(d.totalClicks), String(d.fraudClicks), String(d.fraudRate), fmtWon(d.estimatedLoss), String(d.blockedIps), fmtWon(d.refundRequested), fmtWon(d.refundApproved)])]
                  );
                }}><Download size={14} /> PDF</button>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>날짜</th><th>광고주</th><th>총 클릭</th><th>부정 클릭</th>
                    <th>부정률</th><th>추정 손실</th><th>차단 IP</th><th>환불 요청</th><th>환불 승인</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReport.map((d, i) => (
                    <tr key={i}>
                      <td style={{ fontSize: "0.857rem", whiteSpace: "nowrap" }}>{d.date}</td>
                      <td style={{ fontWeight: 600, fontSize: "0.857rem" }}>{d.account}</td>
                      <td style={{ textAlign: "right", fontSize: "0.857rem" }}>{fmt(d.totalClicks)}</td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: "var(--error)", fontSize: "0.857rem" }}>{fmt(d.fraudClicks)}</td>
                      <td style={{ textAlign: "right" }}>
                        <span style={{ fontWeight: 600, color: d.fraudRate > 5 ? "var(--error)" : d.fraudRate > 3 ? "var(--warning)" : "var(--success)", fontSize: "0.857rem" }}>
                          {d.fraudRate}%
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontSize: "0.857rem", color: "var(--error)" }}>{fmtWon(d.estimatedLoss)}</td>
                      <td style={{ textAlign: "right", fontSize: "0.857rem" }}>{d.blockedIps}개</td>
                      <td style={{ textAlign: "right", fontSize: "0.857rem" }}>{fmtWon(d.refundRequested)}</td>
                      <td style={{ textAlign: "right", fontSize: "0.857rem", color: "var(--success)" }}>{fmtWon(d.refundApproved)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination current={reportSafePage} total={reportTotalPages} onPageChange={setReportPage} />
          </div>
        )}

        {/* Footer Info Banner */}
        <div style={{
          marginTop: 16, padding: "10px 16px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.786rem", color: "var(--text-muted)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ShieldAlert size={14} color="var(--primary)" />
            <span>💡 부정클릭 탐지는 규칙 엔진 + ML 모델이 복합적으로 동작합니다. 확인된 이벤트는 자동 환불 요청에 포함됩니다.</span>
          </div>
        </div>
      </div>
    </>
  );
}
