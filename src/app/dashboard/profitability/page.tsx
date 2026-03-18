"use client";

import { useState } from "react";
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Download, Filter, ChevronRight } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { useToast } from "@/components/Toast";
import { downloadExcel } from "@/utils/export";
import { useProfitability } from "@/hooks/useApi";

type GradeFilter = "all" | "profit" | "low" | "loss";

const summaryKpis: { label: string; value: string; change: string; positive: boolean; color: string }[] = [];

const clients: { name: string; spend: number; commissionRate: number; commission: number; roas: number; margin: number; grade: "profit" | "low" | "loss" }[] = [];

const trendData: { month: string; revenue: number; cost: number; profit: number }[] = [];

const gradeConfig = {
  profit: { label: "🟢 수익", badge: "badge-success" },
  low: { label: "🟡 저수익", badge: "badge-warning" },
  loss: { label: "🔴 적자", badge: "badge-error" },
};

export default function ProfitabilityPage() {
  const [gradeFilter, setGradeFilter] = useState<GradeFilter>("all");
  const [selectedClient, setSelectedClient] = useState<string | null>(null);
  const [period, setPeriod] = useState("this_month");
  const { addToast } = useToast();

  const filtered = clients.filter((c) => gradeFilter === "all" || c.grade === gradeFilter);

  const lossClients = clients.filter((c) => c.grade === "loss");

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">수익성 대시보드</h1>
        <div className="main-header-actions">
          <select className="form-input" style={{ width: 140, padding: "6px 12px" }} value={period} onChange={(e) => { setPeriod(e.target.value); addToast("info", "기간 변경", `${e.target.value === "this_month" ? "이번 달" : e.target.value === "last_month" ? "지난 달" : "3개월"} 데이터를 불러옵니다.`); }}>
            <option value="this_month">이번 달</option>
            <option value="last_month">지난 달</option>
            <option value="3_months">최근 3개월</option>
          </select>
          <button className="btn btn-secondary" onClick={() => {
            downloadExcel("수익성_데이터", ["고객명", "광고비", "수수료율", "수수료", "ROAS", "마진율", "등급"],
              clients.map((c) => [c.name, `₩${c.spend.toLocaleString()}`, `${c.commissionRate}%`, `₩${c.commission.toLocaleString()}`, `${c.roas}%`, `${c.margin}%`, gradeConfig[c.grade].label]));
            addToast("success", "엑셀 내보내기 완료", "수익성 데이터가 다운로드되었습니다.");
          }}><Download size={16} /> 엑셀 내보내기</button>
        </div>
      </header>
      <div className="main-body">
        {/* 14-A: Revenue Summary KPIs */}
        <div className="kpi-grid">
          {summaryKpis.map((kpi) => (
            <div className="kpi-card" key={kpi.label}>
              <div className="kpi-card-icon" style={{ background: `${kpi.color}15`, color: kpi.color }}>
                <DollarSign size={20} />
              </div>
              <div className="kpi-card-label">{kpi.label}</div>
              <div className="kpi-card-value">{kpi.value}</div>
              <span className={`kpi-card-change ${kpi.positive ? "positive" : "negative"}`}>
                {kpi.positive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {kpi.change}
              </span>
            </div>
          ))}
        </div>

        {/* 14-C: Loss Client Alert */}
        {lossClients.length > 0 && (
          <div style={{
            marginBottom: 20, padding: "14px 20px", borderRadius: "var(--radius-lg)",
            background: "#FEF2F2", border: "1px solid #FECACA", display: "flex", alignItems: "center", gap: 12
          }}>
            <AlertTriangle size={20} color="#DC2626" />
            <div>
              <strong style={{ color: "#DC2626" }}>적자 고객 감지</strong>
              {lossClients.map((c) => (
                <span key={c.name} style={{ marginLeft: 12, fontSize: "0.857rem", color: "#7F1D1D" }}>
                  {c.name}: 마진율 {c.margin}% — 수수료 재협상 필요
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="grid-2">
          {/* 14-B: Client Profitability Table */}
          <div className="card">
            <div className="card-header">
              <h3>고객별 수익성</h3>
              <div style={{ display: "flex", gap: 4 }}>
                {(["all", "profit", "low", "loss"] as const).map((g) => (
                  <button key={g} className={`btn btn-sm ${gradeFilter === g ? "btn-primary" : "btn-ghost"}`} onClick={() => setGradeFilter(g)}>
                    {g === "all" ? "전체" : gradeConfig[g].label}
                  </button>
                ))}
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>고객명</th><th>광고비</th><th>수수료율</th><th>수수료</th><th>ROAS</th><th>마진</th><th>등급</th><th></th></tr>
                </thead>
                <tbody>
                  {filtered.map((c) => (
                    <tr key={c.name}
                      style={{ background: selectedClient === c.name ? "var(--primary-light)" : undefined, cursor: "pointer" }}
                      onClick={() => setSelectedClient(selectedClient === c.name ? null : c.name)}
                    >
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td>₩{c.spend.toLocaleString()}</td>
                      <td>{c.commissionRate}%</td>
                      <td style={{ fontWeight: 600 }}>₩{c.commission.toLocaleString()}</td>
                      <td style={{ fontWeight: 600, color: c.roas > 300 ? "var(--success)" : c.roas > 200 ? "var(--warning)" : "var(--error)" }}>{c.roas}%</td>
                      <td style={{ fontWeight: 700, color: c.margin > 10 ? "var(--success)" : c.margin > 0 ? "var(--warning)" : "var(--error)" }}>{c.margin}%</td>
                      <td><span className={`badge ${gradeConfig[c.grade].badge}`}>{gradeConfig[c.grade].label}</span></td>
                      <td><ChevronRight size={16} color="var(--text-muted)" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Client Detail Drawer / Right Panel */}
          <div>
            {selectedClient ? (
              <div className="card" style={{ marginBottom: 20 }}>
                <div className="card-header"><h3>{selectedClient} 상세 수익</h3></div>
                <div className="card-body">
                  {(() => {
                    const c = clients.find((cl) => cl.name === selectedClient)!;
                    const netMarginAmt = Math.round(c.spend * c.margin / 100);
                    return (
                      <div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
                          {[
                            { label: "월 광고비", value: `₩${c.spend.toLocaleString()}` },
                            { label: "수수료율", value: `${c.commissionRate}%` },
                            { label: "수수료 금액", value: `₩${c.commission.toLocaleString()}` },
                            { label: "ROAS", value: `${c.roas}%` },
                            { label: "마진율", value: `${c.margin}%` },
                            { label: "수익등급", value: gradeConfig[c.grade].label },
                          ].map((item) => (
                            <div key={item.label} style={{ padding: "12px 0", borderBottom: "1px solid var(--border)" }}>
                              <div style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>{item.label}</div>
                              <div style={{ fontWeight: 600, marginTop: 4 }}>{item.value}</div>
                            </div>
                          ))}
                        </div>
                        {/* Margin Breakdown Bar */}
                        <div style={{ marginBottom: 8, fontWeight: 600, fontSize: "0.857rem" }}>마진 구성 분해</div>
                        <div style={{ display: "flex", height: 28, borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border)" }}>
                          <div style={{ width: `${100 - c.commissionRate - Math.max(c.margin, 0)}%`, background: "#EF4444", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.714rem", fontWeight: 600 }}>
                            광고비 {(100 - c.commissionRate - Math.max(c.margin, 0)).toFixed(0)}%
                          </div>
                          <div style={{ width: `${c.commissionRate}%`, background: "#3B82F6", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.714rem", fontWeight: 600 }}>
                            수수료 {c.commissionRate}%
                          </div>
                          <div style={{ width: `${Math.max(c.margin, 0)}%`, background: c.margin > 0 ? "#10B981" : "#94A3B8", display: "flex", alignItems: "center", justifyContent: "center", color: "white", fontSize: "0.714rem", fontWeight: 600 }}>
                            순이익 {c.margin}%
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: "0.786rem", color: "var(--text-secondary)" }}>
                          <span>순이익 금액: <strong style={{ color: netMarginAmt >= 0 ? "var(--success)" : "var(--error)" }}>₩{netMarginAmt.toLocaleString()}</strong></span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            ) : (
              <div className="card" style={{ marginBottom: 20, padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                좌측 테이블에서 고객을 클릭하면 상세 수익을 확인할 수 있습니다
              </div>
            )}

            {/* 14-E: Settlement */}
            <div className="card">
              <div className="card-header"><h3>💳 정산 현황</h3></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>고객</th><th>청구 상태</th><th>미수금</th><th>정산 예정</th></tr></thead>
                  <tbody>
                    {[].map((s: any) => (
                      <tr key={s.name}>
                        <td style={{ fontWeight: 600 }}>{s.name}</td>
                        <td><span className={`badge ${s.status === "완료" ? "badge-success" : s.status === "미수" ? "badge-error" : "badge-warning"}`}>{s.status}</span></td>
                        <td style={{ fontWeight: s.unpaid !== "₩0" ? 600 : 400, color: s.unpaid !== "₩0" ? "var(--error)" : undefined }}>{s.unpaid}</td>
                        <td>{s.date}</td>
                      </tr>
                    ))}
                    {clients.length === 0 && (
                      <tr><td colSpan={4} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>정산 데이터가 없습니다.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* 14-D: Revenue Trend Chart */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header"><h3>📈 월별 수익성 트렌드</h3></div>
          <div className="card-body">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={trendData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="month" stroke="var(--text-muted)" fontSize={12} />
                <YAxis stroke="var(--text-muted)" fontSize={12} tickFormatter={(v) => `${(v / 10000000).toFixed(0)}천만`} />
                <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} formatter={(v) => [`₩${Number(v).toLocaleString()}`, ""]} />
                <Line type="monotone" dataKey="revenue" stroke="#1E40AF" strokeWidth={2} name="매출" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="cost" stroke="#EF4444" strokeWidth={2} name="비용" dot={{ r: 4 }} />
                <Line type="monotone" dataKey="profit" stroke="#10B981" strokeWidth={2.5} name="순이익" dot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </>
  );
}
