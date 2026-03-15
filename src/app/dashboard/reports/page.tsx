"use client";

import { useState } from "react";
import { Plus, FileText, Send, Clock, Eye, Download, Calendar, Users, CheckCircle2, XCircle, Settings, X } from "lucide-react";
import { useToast } from "@/components/Toast";
import { downloadPdf } from "@/utils/export";
import { useReports, useReportTemplates } from "@/hooks/useApi";

type ViewTab = "templates" | "history" | "schedule";

const defaultTemplates = [
  { id: 1, name: "주간 성과 보고서", schedule: "weekly", accounts: 6, recipients: 6, lastSent: "2026-03-10", status: "active" },
  { id: 2, name: "월간 종합 리포트", schedule: "monthly", accounts: 6, recipients: 3, lastSent: "2026-03-01", status: "active" },
  { id: 3, name: "A 법률사무소 전용", schedule: "weekly", accounts: 1, recipients: 2, lastSent: "2026-03-10", status: "active" },
];

const recentReports = [
  { id: 1, title: "A 법률사무소 — 주간 보고서 (3/4~3/10)", date: "2026-03-10 09:00", status: "sent", sentTo: 2, opened: 2 },
  { id: 2, title: "B 성형외과 — 주간 보고서 (3/4~3/10)", date: "2026-03-10 09:00", status: "sent", sentTo: 1, opened: 1 },
  { id: 3, title: "월간 종합 리포트 (2월)", date: "2026-03-01 09:00", status: "sent", sentTo: 3, opened: 2 },
  { id: 4, title: "C 치과의원 — 주간 보고서 (3/4~3/10)", date: "2026-03-10 09:00", status: "failed", sentTo: 1, opened: 0 },
  { id: 5, title: "D 부동산 — 주간 보고서 (3/4~3/10)", date: "2026-03-10 09:00", status: "sent", sentTo: 1, opened: 0 },
];

const kpiItems = [
  { key: "impressions", label: "노출수", enabled: true },
  { key: "clicks", label: "클릭수", enabled: true },
  { key: "cost", label: "비용", enabled: true },
  { key: "conversions", label: "전환수", enabled: true },
  { key: "roas", label: "ROAS", enabled: true },
  { key: "ctr", label: "CTR", enabled: false },
  { key: "cpc", label: "CPC", enabled: false },
  { key: "rank", label: "순위 변동", enabled: false },
];

export default function ReportsPage() {
  const [viewTab, setViewTab] = useState<ViewTab>("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<number | null>(null);
  const [kpiConfig, setKpiConfig] = useState(kpiItems.map((k) => ({ ...k })));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [kpiToggles, setKpiToggles] = useState<Record<string, boolean>>(
    Object.fromEntries(kpiItems.map((k) => [k.key, k.enabled]))
  );
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [newReportName, setNewReportName] = useState("");
  const [newReportSchedule, setNewReportSchedule] = useState("weekly");
  const [templates, setTemplates] = useState(defaultTemplates);
  const [scheduleStates, setScheduleStates] = useState<Record<number, boolean>>(
    Object.fromEntries(defaultTemplates.map((t) => [t.id, true]))
  );
  const { addToast } = useToast();

  const toggleKpi = (key: string) => {
    setKpiConfig((prev) => prev.map((k) => k.key === key ? { ...k, enabled: !k.enabled } : k));
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">리포트</h1>
        <div className="main-header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={16} /> 새 리포트 생성</button>
        </div>
      </header>
      <div className="main-body">
        {/* View Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 20, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", padding: 3, width: "fit-content" }}>
          <button className={`btn btn-sm ${viewTab === "templates" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewTab("templates")}>📋 템플릿</button>
          <button className={`btn btn-sm ${viewTab === "history" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewTab("history")}>📨 발송 이력</button>
          <button className={`btn btn-sm ${viewTab === "schedule" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewTab("schedule")}>⏰ 자동 발송</button>
        </div>

        {viewTab === "templates" && (
          <div style={{ display: "grid", gridTemplateColumns: selectedTemplate ? "1fr 1fr" : "1fr", gap: 24 }}>
            {/* Template Gallery */}
            <div className="card">
              <div className="card-header"><h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><FileText size={18} /> 리포트 템플릿</h3></div>
              <div className="card-body">
                <div style={{ display: "grid", gridTemplateColumns: selectedTemplate ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
                  {templates.map((t) => (
                    <div
                      key={t.id}
                      className="card"
                      style={{
                        padding: 20, cursor: "pointer", transition: "all var(--transition)",
                        border: selectedTemplate === t.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                        background: selectedTemplate === t.id ? "var(--primary-light)" : undefined,
                      }}
                      onClick={() => setSelectedTemplate(selectedTemplate === t.id ? null : t.id)}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                        <strong>{t.name}</strong>
                        <span className="badge badge-success">활성</span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.857rem", color: "var(--text-secondary)" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={14} /> {t.schedule === "weekly" ? "매주 월요일" : "매월 1일"}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={14} /> {t.recipients}명 수신</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><FileText size={14} /> {t.accounts}개 계정</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={14} /> {t.lastSent}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                        <button className="btn btn-sm btn-secondary"><Eye size={14} /> 미리보기</button>
                        <button className="btn btn-sm btn-primary"><Send size={14} /> 즉시 발송</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* 7-B: Report Editor Panel */}
            {selectedTemplate && (
              <div className="card">
                <div className="card-header"><h3><Settings size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />리포트 편집</h3></div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">리포트 제목</label>
                    <input className="form-input" defaultValue={templates.find((t) => t.id === selectedTemplate)?.name} />
                  </div>
                  <div className="form-group">
                    <label className="form-label">KPI 항목 선택</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {kpiConfig.map((kpi) => (
                        <label key={kpi.key} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", cursor: "pointer", background: kpi.enabled ? "var(--primary-light)" : undefined }}>
                          <input type="checkbox" checked={kpi.enabled} onChange={() => toggleKpi(kpi.key)} />
                          <span style={{ fontSize: "0.857rem" }}>{kpi.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">기간</label>
                    <select className="form-input"><option>최근 7일</option><option>최근 30일</option><option>이번 달</option><option>커스텀</option></select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">대상 계정 선택</label>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      {["A 법률사무소", "B 성형외과", "C 치과의원", "D 부동산", "E 학원", "F 인테리어"].map((acc) => (
                        <label key={acc} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.857rem", cursor: "pointer" }}>
                          <input type="checkbox" defaultChecked /> {acc}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">수신자 이메일</label>
                    <input className="form-input" placeholder="이메일 주소 (쉼표로 구분)" defaultValue="client@lawfirm.com" />
                  </div>
                  <div className="form-group">
                    <label className="form-label">로고 업로드</label>
                    <div style={{ border: "2px dashed var(--border)", borderRadius: "var(--radius-lg)", padding: 16, textAlign: "center", color: "var(--text-muted)", position: "relative", cursor: "pointer" }}>
                      <input type="file" accept="image/*" style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => setLogoFile(reader.result as string);
                          reader.readAsDataURL(file);
                          addToast("success", "로고 업로드 완료", `'${file.name}' 파일이 업로드되었습니다.`);
                        }
                      }} />
                      {logoFile ? <img src={logoFile} alt="로고" style={{ maxHeight: 60, maxWidth: "100%" }} /> : "클릭하여 로고 업로드"}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="btn btn-primary" onClick={() => addToast("success", "리포트 생성 완료", "리포트가 성공적으로 생성되었습니다.")}><Send size={14} /> 리포트 생성</button>
                    <button className="btn btn-secondary" onClick={() => {
                      const templateName = templates.find((t) => t.id === selectedTemplate)?.name || "리포트";
                      const activeKpis = kpiItems.filter((k) => kpiToggles[k.key]).map((k) => k.label);
                      downloadPdf(`리포트_${templateName}`, `${templateName} - Agency OS`, [
                        ["KPI", "값", "변화"],
                        ...(activeKpis.map((kpi) => [kpi, "-", "-"]) as string[][])
                      ]);
                      addToast("success", "PDF 다운로드", "리포트 PDF가 생성되었습니다.");
                    }}><Download size={14} /> PDF</button>
                  </div>

                  {/* 7-C: Preview */}
                  <div style={{ marginTop: 20, padding: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.786rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>👁️ 미리보기</div>
                    <div style={{ fontSize: "0.857rem", lineHeight: 1.8, color: "var(--text-secondary)" }}>
                      <strong>[{templates.find((t) => t.id === selectedTemplate)?.name}]</strong><br />
                      기간: 최근 7일<br />
                      KPI: {kpiConfig.filter((k) => k.enabled).map((k) => k.label).join(", ")}<br />
                      대상 계정: 6개 · 수신자: 2명<br />
                      <em style={{ color: "var(--text-muted)" }}>실제 PDF 미리보기는 생성 후 확인할 수 있습니다</em>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {viewTab === "history" && (
          <div className="card">
            <div className="card-header"><h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Clock size={18} /> 발송 이력</h3></div>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>리포트</th><th>발송일</th><th>상태</th><th>수신자</th><th>열람</th><th></th></tr></thead>
                <tbody>
                  {recentReports.map((r) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.title}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{r.date}</td>
                      <td>{r.status === "sent" ? <span className="badge badge-success"><CheckCircle2 size={12} /> 발송 완료</span> : <span className="badge badge-error"><XCircle size={12} /> 발송 실패</span>}</td>
                      <td>{r.sentTo}명</td>
                      <td>{r.opened}/{r.sentTo}</td>
                      <td><button className="btn btn-ghost btn-sm"><Download size={14} /> PDF</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {viewTab === "schedule" && (
          <div className="card">
            <div className="card-header"><h3>⏰ 자동 발송 설정</h3></div>
            <div className="card-body">
              {templates.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <strong>{t.name}</strong>
                    <div style={{ fontSize: "0.857rem", color: "var(--text-secondary)", marginTop: 4 }}>
                      {t.schedule === "weekly" ? "매주 월요일 AM 9:00" : t.schedule === "daily" ? "매일 AM 9:00" : "매월 1일 AM 9:00"} · {t.recipients}명 수신
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className={`badge ${scheduleStates[t.id] ? "badge-success" : ""}`}>{scheduleStates[t.id] ? "활성" : "비활성"}</span>
                    <div
                      onClick={() => { setScheduleStates((prev) => ({ ...prev, [t.id]: !prev[t.id] })); addToast(scheduleStates[t.id] ? "info" : "success", `자동 발송 ${scheduleStates[t.id] ? "비활성화" : "활성화"}`, `'${t.name}' 자동 발송이 ${scheduleStates[t.id] ? "중지" : "시작"}되었습니다.`); }}
                      style={{
                        width: 40, height: 22, borderRadius: 12, padding: 2,
                        background: scheduleStates[t.id] ? "var(--primary)" : "var(--border)", position: "relative", cursor: "pointer",
                        transition: "background 0.3s",
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        transform: scheduleStates[t.id] ? "translateX(18px)" : "translateX(0)",
                        transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Report Creation Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 520, width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3>📄 새 리포트 생성</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">리포트 제목</label>
              <input className="form-input" placeholder="예: Q1 월간 성과 리포트" value={newReportName} onChange={(e) => setNewReportName(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">발송 주기</label>
                <select className="form-input" value={newReportSchedule} onChange={(e) => setNewReportSchedule(e.target.value)}>
                  <option value="weekly">매주 월요일</option>
                  <option value="monthly">매월 1일</option>
                  <option value="daily">매일</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">기본 템플릿</label>
                <select className="form-input">
                  <option>주간 성과 보고서</option>
                  <option>월간 종합 리포트</option>
                  <option>공백 템플릿</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">수신자 이메일</label>
              <input className="form-input" placeholder="이메일 주소 (쉼표로 구분)" />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={() => {
                if (!newReportName.trim()) { addToast("error", "리포트 제목을 입력해주세요"); return; }
                const newId = Math.max(...templates.map((t) => t.id)) + 1;
                setTemplates((prev) => [...prev, {
                  id: newId, name: newReportName, schedule: newReportSchedule,
                  accounts: 6, recipients: 1, lastSent: "-", status: "active",
                }]);
                setScheduleStates((prev) => ({ ...prev, [newId]: true }));
                addToast("success", "리포트 생성 완료", `'${newReportName}' 리포트가 생성되었습니다.`);
                setNewReportName("");
                setShowCreateModal(false);
              }}>
                <Plus size={16} /> 리포트 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
