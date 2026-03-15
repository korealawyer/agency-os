"use client";

import { useState, useMemo, useEffect } from "react";
import { TrendingUp, Calculator, FileDown, Sparkles, Save, Link2, Trash2 } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/components/Toast";
import { downloadPdf } from "@/utils/export";

const industries: Record<string, { avgCpc: number; convRate: number }> = {
  "법률": { avgCpc: 890, convRate: 0.035 },
  "의료/성형": { avgCpc: 1800, convRate: 0.025 },
  "교육": { avgCpc: 420, convRate: 0.045 },
  "부동산": { avgCpc: 650, convRate: 0.03 },
  "인테리어": { avgCpc: 580, convRate: 0.032 },
};

const defaultKeywords = "형사변호사\n이혼변호사\n개인회생\n교통사고변호사\n민사소송";

interface SimHistory {
  industry: string;
  budget: number;
  kwText: string;
  savedAt: string;
}

export default function SimulatorPage() {
  const [industry, setIndustry] = useState("법률");
  const [budget, setBudget] = useState(3000000);
  const [kwText, setKwText] = useState(defaultKeywords);
  const [hasRun, setHasRun] = useState(true);
  const [history, setHistory] = useState<SimHistory[]>([]);
  const { addToast } = useToast();

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("sim_history") || "[]");
      setHistory(saved);
    } catch { /* empty */ }
  }, []);

  const handleSave = () => {
    const data: SimHistory = { industry, budget, kwText, savedAt: new Date().toISOString() };
    const saved = [data, ...history].slice(0, 20);
    setHistory(saved);
    localStorage.setItem("sim_history", JSON.stringify(saved));
    addToast("success", "시뮬레이션 저장 완료", "설정과 결과가 저장되었습니다.");
  };

  const handleDeleteHistory = (idx: number) => {
    const updated = history.filter((_, i) => i !== idx);
    setHistory(updated);
    localStorage.setItem("sim_history", JSON.stringify(updated));
    addToast("info", "이력 삭제", "시뮬레이션 이력이 삭제되었습니다.");
  };

  const handleLoadHistory = (item: SimHistory) => {
    setIndustry(item.industry);
    setBudget(item.budget);
    setKwText(item.kwText);
    addToast("success", "이력 불러오기", "저장된 시뮬레이션 설정을 불러왔습니다.");
  };

  const handleShare = () => {
    const params = new URLSearchParams({ industry, budget: String(budget), kw: kwText });
    const url = `${window.location.origin}/dashboard/simulator?${params.toString()}`;
    navigator.clipboard.writeText(url);
    addToast("success", "URL 복사 완료", "시뮬레이션 URL이 클립보드에 복사되었습니다.");
  };

  const handlePdf = () => {
    downloadPdf("시뮬레이션_제안서", `ROI 시뮬레이션 제안서 - ${industry}`, [
      ["항목", "최소", "최대"],
      ["예상 노출", results.impressions.low.toLocaleString(), results.impressions.high.toLocaleString()],
      ["예상 클릭", results.clicks.low.toLocaleString(), results.clicks.high.toLocaleString()],
      ["예상 전환", String(results.conversions.low), String(results.conversions.high)],
      ["예상 ROAS", `${results.roas.low}%`, `${results.roas.high}%`],
      ["예상 CPC", `₩${results.cpc.low.toLocaleString()}`, `₩${results.cpc.high.toLocaleString()}`],
    ]);
  };

  const ind = industries[industry];
  const keywordList = kwText.trim().split("\n").filter(Boolean);

  const results = useMemo(() => {
    const clicks = Math.round(budget / ind.avgCpc);
    const impressions = Math.round(clicks / 0.05);
    const conversions = Math.round(clicks * ind.convRate);
    const roas = conversions > 0 ? Math.round((conversions * 150000) / budget * 100) : 0;
    return {
      impressions: { low: Math.round(impressions * 0.8), high: Math.round(impressions * 1.2) },
      clicks: { low: Math.round(clicks * 0.75), high: Math.round(clicks * 1.25) },
      conversions: { low: Math.max(1, Math.round(conversions * 0.6)), high: Math.round(conversions * 1.4) },
      roas: { low: Math.round(roas * 0.75), high: Math.round(roas * 1.3) },
      cpc: { low: Math.round(ind.avgCpc * 0.7), high: Math.round(ind.avgCpc * 1.15) },
    };
  }, [industry, budget, ind]);

  const chartData = useMemo(() => {
    return keywordList.slice(0, 8).map((kw, i) => ({
      name: kw.length > 5 ? kw.slice(0, 5) + ".." : kw,
      conversions: Math.max(1, Math.round((results.conversions.high / keywordList.length) * (1 + Math.sin(i) * 0.5))),
      color: ["#1E40AF", "#7C3AED", "#10B981", "#F59E0B", "#EC4899", "#EF4444", "#06B6D4", "#8B5CF6"][i % 8],
    }));
  }, [keywordList, results.conversions.high]);

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">ROI 시뮬레이터</h1>
        <div className="main-header-actions">
          <button className="btn btn-secondary" onClick={handleSave}><Save size={16} /> 저장</button>
          <button className="btn btn-secondary" onClick={handleShare}><Link2 size={16} /> URL 공유</button>
          <button className="btn btn-secondary" onClick={handlePdf}><FileDown size={16} /> PDF 제안서</button>
        </div>
      </header>
      <div className="main-body">
        <div className="grid-2">
          {/* Input Panel */}
          <div className="card">
            <div className="card-header"><h3><Calculator size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />시뮬레이션 설정</h3></div>
            <div className="card-body">
              <div className="form-group">
                <label className="form-label">업종</label>
                <select className="form-input" value={industry} onChange={(e) => setIndustry(e.target.value)}>
                  {Object.keys(industries).map((ind) => <option key={ind}>{ind}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">월 예산</label>
                <input
                  className="form-input"
                  type="text"
                  value={`₩${budget.toLocaleString()}`}
                  onChange={(e) => {
                    const n = parseInt(e.target.value.replace(/[^\d]/g, ""));
                    if (!isNaN(n)) setBudget(n);
                  }}
                />
                <input
                  type="range" min={500000} max={50000000} step={500000} value={budget}
                  onChange={(e) => setBudget(+e.target.value)}
                  style={{ width: "100%", marginTop: 8, accentColor: "var(--primary)" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.714rem", color: "var(--text-muted)" }}>
                  <span>₩50만</span><span>₩5,000만</span>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">키워드 (최대 50개, 줄바꿈으로 구분)</label>
                <textarea
                  className="form-input"
                  rows={5}
                  value={kwText}
                  onChange={(e) => setKwText(e.target.value)}
                  style={{ resize: "vertical" }}
                />
                <div style={{ fontSize: "0.786rem", color: "var(--text-muted)", marginTop: 4 }}>
                  {keywordList.length}개 키워드 입력됨
                </div>
              </div>
              <button
                className="btn btn-primary btn-lg"
                style={{ width: "100%" }}
                onClick={() => setHasRun(true)}
              >
                <Sparkles size={18} /> 시뮬레이션 실행
              </button>
            </div>
          </div>

          {/* Results Panel */}
          <div>
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><h3><TrendingUp size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />예상 결과 (95% 신뢰구간)</h3></div>
              <div className="card-body">
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                  {[
                    { label: "예상 노출", low: results.impressions.low.toLocaleString(), high: results.impressions.high.toLocaleString() },
                    { label: "예상 클릭", low: results.clicks.low.toLocaleString(), high: results.clicks.high.toLocaleString() },
                    { label: "예상 전환", low: results.conversions.low.toString(), high: results.conversions.high.toString() },
                    { label: "예상 ROAS", low: `${results.roas.low}%`, high: `${results.roas.high}%` },
                    { label: "예상 CPC", low: `₩${results.cpc.low.toLocaleString()}`, high: `₩${results.cpc.high.toLocaleString()}` },
                  ].map((r) => (
                    <div key={r.label} style={{ textAlign: "center", padding: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)" }}>
                      <div style={{ fontSize: "0.786rem", color: "var(--text-muted)", marginBottom: 4 }}>{r.label}</div>
                      <div style={{ fontWeight: 700, fontSize: "1.143rem" }}>{r.low} ~ {r.high}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* AI Tip */}
            <div className="card ai-panel" style={{ marginBottom: 24, padding: "16px 24px" }}>
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <Sparkles size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: 2 }} />
                <div>
                  <strong>AI 추천</strong>
                  <p style={{ fontSize: "0.857rem", color: "var(--text-secondary)", marginTop: 4 }}>
                    {industry === "법률" ?
                      `"${keywordList[0] || "형사변호사"}"에 예산 40% 집중 시 전환율 +25% 예상됩니다. 월 예산 ₩${(budget / 10000).toLocaleString()}만원 기준 ${industry} 업종 평균 CPC는 ₩${ind.avgCpc}입니다.` :
                      `${industry} 업종 평균 CPC ₩${ind.avgCpc} 기준, 예산 대비 효율적인 키워드 조합을 추천합니다. 전환율 ${(ind.convRate * 100).toFixed(1)}% 적용.`
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Chart */}
            <div className="card">
              <div className="card-header"><h3>키워드별 예상 전환</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={Math.max(200, chartData.length * 35)}>
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis type="number" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis type="category" dataKey="name" stroke="var(--text-muted)" fontSize={12} width={80} />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                    <Bar dataKey="conversions" radius={[0, 6, 6, 0]}>
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Simulation History */}
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header"><h3>📁 시뮬레이션 이력 ({history.length}건)</h3></div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>날짜</th><th>업종</th><th>월 예산</th><th>키워드</th><th></th></tr></thead>
              <tbody>
                {history.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>저장된 이력이 없습니다. 시뮬레이션을 실행 후 저장해보세요.</td></tr>
                ) : history.map((item, idx) => {
                  const kwCount = item.kwText.trim().split("\n").filter(Boolean).length;
                  return (
                    <tr key={idx}>
                      <td>{new Date(item.savedAt).toLocaleDateString("ko-KR")}</td>
                      <td>{item.industry}</td>
                      <td style={{ fontWeight: 600 }}>₩{item.budget.toLocaleString()}</td>
                      <td>{kwCount}개</td>
                      <td style={{ display: "flex", gap: 4 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleLoadHistory(item)}>불러오기</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => {
                          const ind = industries[item.industry];
                          const clicks = Math.round(item.budget / ind.avgCpc);
                          const impressions = Math.round(clicks / 0.05);
                          const conversions = Math.round(clicks * ind.convRate);
                          const roas = conversions > 0 ? Math.round((conversions * 150000) / item.budget * 100) : 0;
                          downloadPdf("시뮬레이션_제안서", `ROI 시뮬레이션 제안서 - ${item.industry}`, [
                            ["항목", "최소", "최대"],
                            ["예상 노출", Math.round(impressions * 0.8).toLocaleString(), Math.round(impressions * 1.2).toLocaleString()],
                            ["예상 클릭", Math.round(clicks * 0.75).toLocaleString(), Math.round(clicks * 1.25).toLocaleString()],
                            ["예상 전환", String(Math.max(1, Math.round(conversions * 0.6))), String(Math.round(conversions * 1.4))],
                            ["예상 ROAS", `${Math.round(roas * 0.75)}%`, `${Math.round(roas * 1.3)}%`],
                          ]);
                        }}><FileDown size={14} /> PDF</button>
                        <button className="btn btn-ghost btn-sm" onClick={() => handleDeleteHistory(idx)} style={{ color: "var(--error)" }}><Trash2 size={14} /></button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
