"use client";

import { useState } from "react";
import { Plus, FileText, Send, Clock, Eye, Download, Calendar, Users, CheckCircle2, XCircle, Settings, X, Loader2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { downloadPdf } from "@/utils/export";
import { useReports, useReportTemplates, useAccounts, useDashboard } from "@/hooks/useApi";
import { apiMutate, invalidateAll } from "@/hooks/useApi";

type ViewTab = "templates" | "history" | "schedule";

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const [kpiConfig, setKpiConfig] = useState(kpiItems.map((k) => ({ ...k })));
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newReportName, setNewReportName] = useState("");
  const [newReportSchedule, setNewReportSchedule] = useState("weekly");
  const [logoFile, setLogoFile] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const { addToast } = useToast();

  // ── API 훅 ──
  const { data: templatesRaw, isLoading: templatesLoading, mutate: mutateTemplates } = useReportTemplates();
  const { data: reportsRaw, isLoading: reportsLoading } = useReports(1, 50);
  const { data: accountsData } = useAccounts(1, 100);
  const { data: dashboardData } = useDashboard();

  const dbTemplates: any[] = Array.isArray(templatesRaw) ? templatesRaw : [];
  const dbReports: any[] = Array.isArray(reportsRaw) ? reportsRaw : [];
  const accountNames = (accountsData ?? []).map((a: any) => a.customerName || a.name).filter(Boolean);
  const kpiDataList = dashboardData?.kpi ?? dashboardData?.kpis ?? [];

  const selectedTemplate = dbTemplates.find((t) => t.id === selectedTemplateId) ?? null;

  const toggleKpi = (key: string) => {
    setKpiConfig((prev) => prev.map((k) => k.key === key ? { ...k, enabled: !k.enabled } : k));
  };

  // ── 템플릿 생성 (DB 저장) ──
  const handleCreateTemplate = async () => {
    if (!newReportName.trim()) { addToast("error", "리포트 제목을 입력해주세요"); return; }
    setIsSaving(true);
    try {
      await apiMutate("/api/reports/templates", {
        method: "POST",
        body: JSON.stringify({
          name: newReportName,
          scheduleType: newReportSchedule as "weekly" | "monthly",
          kpiConfig: Object.fromEntries(kpiItems.map((k) => [k.key, k.enabled])),
          recipientEmails: [],
          naverAccountIds: [],
        }),
      });
      await mutateTemplates();
      invalidateAll("/api/reports");
      addToast("success", "리포트 생성 완료", `'${newReportName}' 리포트가 저장되었습니다.`);
      setNewReportName("");
      setShowCreateModal(false);
    } catch (e: any) {
      addToast("error", "저장 실패", e.message);
    } finally {
      setIsSaving(false);
    }
  };

  // ── 템플릿 삭제 ──
  const handleDeleteTemplate = async (id: string, name: string) => {
    setIsDeleting(id);
    try {
      await apiMutate(`/api/reports/templates/${id}`, { method: "DELETE" });
      await mutateTemplates();
      if (selectedTemplateId === id) setSelectedTemplateId(null);
      addToast("info", "삭제 완료", `'${name}' 리포트가 삭제되었습니다.`);
    } catch (e: any) {
      addToast("error", "삭제 실패", e.message);
    } finally {
      setIsDeleting(null);
    }
  };

  // ── 스케줄 토글 (DB 저장) ──
  const handleToggleSchedule = async (template: any) => {
    try {
      const newSchedule = template.scheduleType ? null : "weekly";
      await apiMutate(`/api/reports/templates/${template.id}`, {
        method: "PATCH",
        body: JSON.stringify({ scheduleType: newSchedule }),
      });
      await mutateTemplates();
      addToast(newSchedule ? "success" : "info", `자동 발송 ${newSchedule ? "활성화" : "비활성화"}`, `'${template.name}' 자동 발송이 ${newSchedule ? "시작" : "중지"}되었습니다.`);
    } catch (e: any) {
      addToast("error", "변경 실패", e.message);
    }
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
                {templatesLoading ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                    <Loader2 size={24} style={{ animation: "spin 1s linear infinite", marginBottom: 8 }} />
                    <div>로딩 중...</div>
                  </div>
                ) : dbTemplates.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "0.929rem" }}>
                    <FileText size={32} color="var(--border)" style={{ marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
                    생성된 리포트 템플릿이 없습니다<br />
                    <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowCreateModal(true)}>리포트 생성하기</button>
                  </div>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: selectedTemplate ? "1fr" : "repeat(3, 1fr)", gap: 16 }}>
                    {dbTemplates.map((t) => (
                      <div
                        key={t.id}
                        className="card"
                        style={{
                          padding: 20, cursor: "pointer", transition: "all var(--transition)",
                          border: selectedTemplateId === t.id ? "2px solid var(--primary)" : "1px solid var(--border)",
                          background: selectedTemplateId === t.id ? "var(--primary-light)" : undefined,
                        }}
                        onClick={() => setSelectedTemplateId(selectedTemplateId === t.id ? null : t.id)}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
                          <strong>{t.name}</strong>
                          <span className="badge badge-success">활성</span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.857rem", color: "var(--text-secondary)" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Calendar size={14} /> {t.scheduleType === "weekly" ? "매주 월요일" : "매월 1일"}</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Users size={14} /> {(t.recipientEmails ?? []).length}명 수신</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><FileText size={14} /> {(t.naverAccountIds ?? []).length}개 계정</div>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={14} /> {t.updatedAt ? new Date(t.updatedAt).toLocaleDateString("ko-KR") : "-"}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                          <button className="btn btn-sm btn-secondary" onClick={(e) => { e.stopPropagation(); setSelectedTemplateId(t.id); }}><Eye size={14} /> 편집</button>
                          <button
                            className="btn btn-sm btn-ghost"
                            style={{ color: "var(--error)" }}
                            disabled={isDeleting === t.id}
                            onClick={(e) => { e.stopPropagation(); handleDeleteTemplate(t.id, t.name); }}
                          >
                            {isDeleting === t.id ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <X size={14} />}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Report Editor Panel */}
            {selectedTemplate && (
              <div className="card">
                <div className="card-header"><h3><Settings size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />리포트 편집</h3></div>
                <div className="card-body">
                  <div className="form-group">
                    <label className="form-label">리포트 제목</label>
                    <input className="form-input" defaultValue={selectedTemplate.name} />
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
                      {(accountNames.length > 0 ? accountNames : ["연동된 계정 없음"]).map((acc: string) => (
                        <label key={acc} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: "0.857rem", cursor: "pointer" }}>
                          <input type="checkbox" defaultChecked /> {acc}
                        </label>
                      ))}
                    </div>
                  </div>
                  <div className="form-group">
                    <label className="form-label">수신자 이메일</label>
                    <input className="form-input" placeholder="이메일 주소 (쉼표로 구분)" defaultValue={(selectedTemplate.recipientEmails ?? []).join(", ")} />
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
                      const activeKpis = kpiConfig.filter((k) => k.enabled);
                      const kpiRows = activeKpis.map((kpi) => {
                        const matched = Array.isArray(kpiDataList)
                          ? kpiDataList.find((d: any) => d.id === kpi.key)
                          : undefined;
                        return [kpi.label, matched ? matched.value : "-", matched ? matched.change : "-"];
                      });
                      downloadPdf(`리포트_${selectedTemplate.name}`, `${selectedTemplate.name} - Agency OS`, [
                        ["KPI", "값", "전주 대비 변동"],
                        ...(kpiRows as string[][])
                      ]);
                      addToast("success", "PDF 다운로드", "리포트 PDF가 생성되었습니다.");
                    }}><Download size={14} /> PDF</button>
                  </div>

                  {/* Preview */}
                  <div style={{ marginTop: 20, padding: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)" }}>
                    <div style={{ fontSize: "0.786rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>👁️ 미리보기</div>
                    <div style={{ fontSize: "0.857rem", lineHeight: 1.8, color: "var(--text-secondary)" }}>
                      <strong>[{selectedTemplate.name}]</strong><br />
                      기간: 최근 7일<br />
                      KPI: {kpiConfig.filter((k) => k.enabled).map((k) => k.label).join(", ")}<br />
                      대상 계정: {accountNames.length}개 · 수신자: {(selectedTemplate.recipientEmails ?? []).length}명<br />
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
                  {reportsLoading ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                      <Loader2 size={24} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 8px" }} />
                      로딩 중...
                    </td></tr>
                  ) : dbReports.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)", fontSize: "0.929rem" }}>
                      <Clock size={32} color="var(--border)" style={{ marginBottom: 12, display: "block", margin: "0 auto 12px" }} />
                      발송된 리포트가 없습니다
                    </td></tr>
                  ) : dbReports.map((r: any) => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600 }}>{r.title}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{r.sentAt ? new Date(r.sentAt).toLocaleDateString("ko-KR") : "-"}</td>
                      <td>{r.sentAt ? <span className="badge badge-success"><CheckCircle2 size={12} /> 발송 완료</span> : <span className="badge badge-warning">대기</span>}</td>
                      <td>{Array.isArray(r.sentTo) ? r.sentTo.length : 0}명</td>
                      <td>-</td>
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
              {templatesLoading ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)" }}>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : dbTemplates.length === 0 ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "var(--text-muted)", fontSize: "0.929rem" }}>
                  <Calendar size={32} color="var(--border)" style={{ marginBottom: 12 }} />
                  <div>자동 발송 스케줄이 없습니다</div>
                  <div style={{ fontSize: "0.786rem", marginTop: 4 }}>새 리포트를 생성하면 자동 발송을 설정할 수 있습니다</div>
                  <button className="btn btn-primary btn-sm" style={{ marginTop: 12 }} onClick={() => setShowCreateModal(true)}>리포트 생성하기</button>
                </div>
              ) : dbTemplates.map((t) => (
                <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                  <div>
                    <strong>{t.name}</strong>
                    <div style={{ fontSize: "0.857rem", color: "var(--text-secondary)", marginTop: 4 }}>
                      {t.scheduleType === "weekly" ? "매주 월요일 AM 9:00" : t.scheduleType === "monthly" ? "매월 1일 AM 9:00" : "비활성"} · {(t.recipientEmails ?? []).length}명 수신
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span className={`badge ${t.scheduleType ? "badge-success" : ""}`}>{t.scheduleType ? "활성" : "비활성"}</span>
                    <div
                      onClick={() => handleToggleSchedule(t)}
                      style={{
                        width: 40, height: 22, borderRadius: 12, padding: 2,
                        background: t.scheduleType ? "var(--primary)" : "var(--border)", position: "relative", cursor: "pointer",
                        transition: "background 0.3s",
                      }}
                    >
                      <div style={{
                        width: 18, height: 18, borderRadius: "50%", background: "#fff",
                        transform: t.scheduleType ? "translateX(18px)" : "translateX(0)",
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
          <div style={{ background: "var(--bg-card, var(--surface))", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 520, width: "100%", boxShadow: "var(--shadow-xl)" }}>
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
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">수신자 이메일</label>
              <input className="form-input" placeholder="이메일 주소 (쉼표로 구분)" />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleCreateTemplate} disabled={isSaving}>
                {isSaving ? <Loader2 size={16} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={16} />} 리포트 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
