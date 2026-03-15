"use client";

import { useState } from "react";
import { Search, Shield, TrendingUp, TrendingDown, Eye, Bell, Sparkles, AlertTriangle, Upload, Download } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, LineChart, Line } from "recharts";
import { useToast } from "@/components/Toast";
import { downloadCsv } from "@/utils/export";
import { parseCSV, readFileAsText } from "@/utils/csv";
import { useCompetitive } from "@/hooks/useApi";

const overlapData = [
  { name: "내 키워드만", value: 45, color: "#1E40AF" },
  { name: "중첩", value: 28, color: "#7C3AED" },
  { name: "경쟁사만", value: 32, color: "#EF4444" },
];

const biddingTrend = [
  { date: "3/6", mine: 890, compA: 920, compB: 780, compC: 850 },
  { date: "3/7", mine: 890, compA: 950, compB: 800, compC: 870 },
  { date: "3/8", mine: 900, compA: 980, compB: 810, compC: 860 },
  { date: "3/9", mine: 900, compA: 1050, compB: 820, compC: 890 },
  { date: "3/10", mine: 920, compA: 1100, compB: 830, compC: 900 },
  { date: "3/11", mine: 920, compA: 1120, compB: 840, compC: 910 },
  { date: "3/12", mine: 950, compA: 1150, compB: 850, compC: 920 },
];

const impressionShare = [
  { keyword: "형사변호사", mine: 35, compA: 28, compB: 22, compC: 15 },
  { keyword: "이혼변호사", mine: 42, compA: 20, compB: 25, compC: 13 },
  { keyword: "교통사고변호사", mine: 55, compA: 15, compB: 18, compC: 12 },
  { keyword: "임플란트가격", mine: 30, compA: 32, compB: 20, compC: 18 },
  { keyword: "쌍꺼풀수술", mine: 25, compA: 35, compB: 22, compC: 18 },
];

const aiInsights = [
  { id: 1, severity: "high", text: "경쟁사 A가 '형사변호사' 입찰가를 20% 상향했습니다. 방어 전략이 필요합니다.", action: "입찰 방어" },
  { id: 2, severity: "medium", text: "'교통사고변호사' 경쟁 입찰가가 하락 추세입니다. 시장 점유율 확대 기회입니다.", action: "공격 확대" },
  { id: 3, severity: "low", text: "경쟁사 C가 '임플란트가격' 키워드를 신규 진입했습니다. 모니터링을 권장합니다.", action: "모니터링" },
];

export default function CompetitivePage() {
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const [selectedKeyword, setSelectedKeyword] = useState("형사변호사");
  const { addToast } = useToast();

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">경쟁 인텔리전스</h1>
        <div className="main-header-actions">
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.857rem" }}>
            <Bell size={16} />
            <span>경쟁 알림</span>
            <div
              style={{
                width: 40, height: 22, borderRadius: 12, padding: 2, cursor: "pointer",
                background: alertsEnabled ? "var(--primary)" : "var(--border)", transition: "all 0.3s",
              }}
              onClick={() => { setAlertsEnabled(!alertsEnabled); addToast(alertsEnabled ? "info" : "success", alertsEnabled ? "경쟁 알림 비활성화" : "경쟁 알림 활성화", alertsEnabled ? "경쟁사 변동 알림을 끔습니다." : "경쟁사 변동 시 알림을 받습니다."); }}
            >
              <div style={{
                width: 18, height: 18, borderRadius: "50%", background: "#fff",
                transform: alertsEnabled ? "translateX(18px)" : "translateX(0)",
                transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }} />
            </div>
          </div>
        </div>
      </header>
      <div className="main-body">
        {/* Import/Export toolbar */}
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
            <Upload size={16} /> 경쟁사 데이터 CSV 임포트
            <input type="file" accept=".csv" style={{ display: "none" }} onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const text = await readFileAsText(file);
                const { rowCount } = parseCSV(text);
                addToast("success", "임포트 완료", `${file.name}에서 ${rowCount}건의 경쟁사 데이터를 가져왔습니다.`);
              } catch {
                addToast("error", "임포트 실패", "파일 형식을 확인해주세요.");
              }
              e.target.value = "";
            }} />
          </label>
          <button className="btn btn-secondary" onClick={() => {
            downloadCsv("경쟁사_노출점유율", ["키워드", "내 브랜드", "경쟁사 A", "경쟁사 B", "경쟁사 C"],
              impressionShare.map((r) => [r.keyword, `${r.mine}%`, `${r.compA}%`, `${r.compB}%`, `${r.compC}%`]));
            addToast("success", "CSV 내보내기 완료");
          }}><Download size={16} /> 노출점유율 CSV</button>
        </div>
        {/* 15-D: AI Insight Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 24 }}>
          {aiInsights.map((insight) => (
            <div key={insight.id} className="card" style={{
              padding: 20,
              borderLeft: `4px solid ${insight.severity === "high" ? "var(--error)" : insight.severity === "medium" ? "var(--warning)" : "var(--primary)"}`
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <Sparkles size={16} color="var(--primary)" />
                <span className={`badge ${insight.severity === "high" ? "badge-error" : insight.severity === "medium" ? "badge-warning" : "badge-info"}`}>
                  {insight.severity === "high" ? "🔴 긴급" : insight.severity === "medium" ? "🟡 주의" : "🔵 참고"}
                </span>
              </div>
              <p style={{ fontSize: "0.857rem", color: "var(--text-secondary)", marginBottom: 12, lineHeight: 1.6 }}>{insight.text}</p>
              <button className="btn btn-sm btn-primary">{insight.action}</button>
            </div>
          ))}
        </div>

        <div className="grid-2">
          {/* 15-A: Keyword Overlap */}
          <div className="card">
            <div className="card-header"><h3>🔑 키워드 중첩 분석</h3></div>
            <div className="card-body">
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 32, padding: 16 }}>
                {/* Venn-like visual */}
                <div style={{ position: "relative", width: 280, height: 180 }}>
                  <div style={{
                    position: "absolute", left: 20, top: 10, width: 160, height: 160,
                    borderRadius: "50%", background: "rgba(30,64,175,0.1)",
                    border: "2px solid #1E40AF", display: "flex", alignItems: "center",
                    justifyContent: "center", flexDirection: "column",
                  }}>
                    <strong style={{ color: "#1E40AF" }}>45</strong>
                    <span style={{ fontSize: "0.714rem", color: "var(--text-muted)" }}>내 키워드</span>
                  </div>
                  <div style={{
                    position: "absolute", right: 20, top: 10, width: 160, height: 160,
                    borderRadius: "50%", background: "rgba(239,68,68,0.1)",
                    border: "2px solid #EF4444", display: "flex", alignItems: "center",
                    justifyContent: "center", flexDirection: "column",
                  }}>
                    <strong style={{ color: "#EF4444" }}>32</strong>
                    <span style={{ fontSize: "0.714rem", color: "var(--text-muted)" }}>경쟁사</span>
                  </div>
                  <div style={{
                    position: "absolute", left: "50%", top: "50%", transform: "translate(-50%, -50%)",
                    background: "rgba(124,58,237,0.15)", borderRadius: "50%", width: 80, height: 80,
                    display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
                    zIndex: 1,
                  }}>
                    <strong style={{ color: "#7C3AED" }}>28</strong>
                    <span style={{ fontSize: "0.643rem", color: "var(--text-muted)" }}>중첩</span>
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "center", gap: 24, fontSize: "0.857rem", marginTop: 8 }}>
                <span><span style={{ color: "#1E40AF", fontWeight: 700 }}>45</span> 고유 키워드</span>
                <span><span style={{ color: "#7C3AED", fontWeight: 700 }}>28</span> 경쟁 중첩</span>
                <span><span style={{ color: "#EF4444", fontWeight: 700 }}>32</span> 경쟁사 고유</span>
              </div>
            </div>
          </div>

          {/* 15-B: Competitor Bidding Trend */}
          <div className="card">
            <div className="card-header">
              <h3>📈 경쟁 입찰 추이</h3>
              <select className="form-input" style={{ width: 160, padding: "4px 8px", fontSize: "0.857rem" }}
                value={selectedKeyword} onChange={(e) => setSelectedKeyword(e.target.value)}>
                <option>형사변호사</option><option>이혼변호사</option><option>교통사고변호사</option>
              </select>
            </div>
            <div className="card-body">
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={biddingTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                  <YAxis stroke="var(--text-muted)" fontSize={12} unit="원" />
                  <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} formatter={(v) => [`₩${v}`, ""]} />
                  <Line type="monotone" dataKey="mine" stroke="#1E40AF" strokeWidth={2.5} name="내 입찰" dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="compA" stroke="#EF4444" strokeWidth={1.5} strokeDasharray="5 5" name="경쟁사 A" dot={false} />
                  <Line type="monotone" dataKey="compB" stroke="#F59E0B" strokeWidth={1.5} strokeDasharray="5 5" name="경쟁사 B" dot={false} />
                  <Line type="monotone" dataKey="compC" stroke="#94A3B8" strokeWidth={1.5} strokeDasharray="5 5" name="경쟁사 C" dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* 15-C: Impression Share Heatmap Table */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header"><h3>📊 노출 점유율 (IS%)</h3></div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>키워드</th><th>내 브랜드</th><th>경쟁사 A</th><th>경쟁사 B</th><th>경쟁사 C</th><th>기타</th></tr>
              </thead>
              <tbody>
                {impressionShare.map((row) => {
                  const rest = 100 - row.mine - row.compA - row.compB - row.compC;
                  const cellStyle = (val: number) => ({
                    fontWeight: 600 as const,
                    background: val > 35 ? "rgba(16,185,129,0.12)" : val > 25 ? "rgba(245,158,11,0.12)" : val > 15 ? "rgba(239,68,68,0.08)" : undefined,
                    color: val > 35 ? "var(--success)" : val > 25 ? "var(--warning)" : "var(--text-secondary)",
                  });
                  return (
                    <tr key={row.keyword}>
                      <td style={{ fontWeight: 600 }}>{row.keyword}</td>
                      <td style={cellStyle(row.mine)}>{row.mine}%</td>
                      <td style={cellStyle(row.compA)}>{row.compA}%</td>
                      <td style={cellStyle(row.compB)}>{row.compB}%</td>
                      <td style={cellStyle(row.compC)}>{row.compC}%</td>
                      <td style={{ color: "var(--text-muted)" }}>{rest}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 16px", fontSize: "0.714rem", color: "var(--text-muted)", borderTop: "1px solid var(--border)" }}>
            💡 배경색 강도가 높을수록 점유율이 높습니다. 30% 이상: 녹색 / 25%+: 노란색 / 15%+: 연분홍
          </div>
        </div>
      </div>
    </>
  );
}
