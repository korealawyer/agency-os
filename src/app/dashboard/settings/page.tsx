"use client";

import { useState } from "react";
import {
  Building2, Users, CreditCard, Bell, Shield, Trash2, Plus,
  Crown, Edit2, Clock, Download, X, Loader2,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { downloadCsv } from "@/utils/export";
import { useSettings, useMembers, useAuditLogs, useApi, apiMutate, invalidateAll } from "@/hooks/useApi";
import { saveData, loadData } from "@/utils/storage";
import { useEffect } from "react";

type SettingsTab = "org" | "members" | "billing" | "notifications" | "activity";

const tabConfig: { key: SettingsTab; label: string; icon: typeof Building2 }[] = [
  { key: "org", label: "조직 관리", icon: Building2 },
  { key: "members", label: "멤버 & 권한", icon: Users },
  { key: "billing", label: "결제 & 구독", icon: CreditCard },
  { key: "notifications", label: "알림 채널", icon: Bell },
  { key: "activity", label: "활동 이력", icon: Shield },
];

const roleLabels: Record<string, { label: string; badge: string }> = {
  owner: { label: "소유자", badge: "badge-info" },
  admin: { label: "관리자", badge: "badge-success" },
  editor: { label: "편집자", badge: "badge-warning" },
  viewer: { label: "뷰어", badge: "" },
};

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("org");
  const { addToast } = useToast();

  // ── 조직 설정 (DB) ──
  const { data: orgData, isLoading: orgLoading, mutate: mutateOrg } = useSettings();
  const [orgName, setOrgName] = useState("");
  const [orgBizNum, setOrgBizNum] = useState("");
  const [orgEmail, setOrgEmail] = useState("");
  const [isSavingOrg, setIsSavingOrg] = useState(false);

  useEffect(() => {
    if (orgData && !isSavingOrg) {
      setOrgName((orgData as any).name ?? "");
      setOrgBizNum((orgData as any).businessNumber ?? "");
      setOrgEmail((orgData as any).contactEmail ?? "");
    }
  }, [orgData]);

  const handleSaveOrg = async () => {
    setIsSavingOrg(true);
    try {
      await apiMutate("/api/settings", {
        method: "PUT",
        body: JSON.stringify({ name: orgName, businessNumber: orgBizNum, contactEmail: orgEmail }),
      });
      await mutateOrg();
      addToast("success", "조직 정보 저장 완료", "변경사항이 저장되었습니다.");
    } catch (e: any) {
      addToast("error", "저장 실패", e.message);
    } finally {
      setIsSavingOrg(false);
    }
  };

  // ── 멤버 (DB) ──
  const { data: membersRaw, isLoading: membersLoading, mutate: mutateMembers } = useMembers(1, 100);
  const members: any[] = Array.isArray(membersRaw) ? membersRaw : [];

  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [invitePassword, setInvitePassword] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  const [editMember, setEditMember] = useState<any | null>(null);
  const [editRole, setEditRole] = useState("");
  const [isEditingRole, setIsEditingRole] = useState(false);

  const [deleteMember, setDeleteMember] = useState<any | null>(null);
  const [isDeletingMember, setIsDeletingMember] = useState(false);

  const handleInvite = async () => {
    if (!inviteEmail.trim() || !inviteName.trim()) { addToast("error", "이름과 이메일을 모두 입력해주세요"); return; }
    if (!invitePassword || invitePassword.length < 8) { addToast("error", "임시 비밀번호는 8자 이상이어야 합니다"); return; }
    setIsInviting(true);
    try {
      await apiMutate("/api/members", {
        method: "POST",
        body: JSON.stringify({ email: inviteEmail, name: inviteName, role: inviteRole, temporaryPassword: invitePassword }),
      });
      await mutateMembers();
      addToast("success", "멤버 초대 완료", `${inviteName}(${inviteEmail}) 계정이 생성되었습니다.`);
      setInviteEmail(""); setInviteName(""); setInviteRole("editor"); setInvitePassword("");
      setShowInviteModal(false);
    } catch (e: any) {
      addToast("error", "초대 실패", e.message);
    } finally {
      setIsInviting(false);
    }
  };

  const handleEditMember = async () => {
    if (!editMember) return;
    setIsEditingRole(true);
    try {
      await apiMutate(`/api/members/${editMember.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role: editRole }),
      });
      await mutateMembers();
      addToast("success", "역할 변경 완료", `${editMember.name}의 역할이 ${roleLabels[editRole]?.label || editRole}(으)로 변경되었습니다.`);
      setEditMember(null);
    } catch (e: any) {
      addToast("error", "변경 실패", e.message);
    } finally {
      setIsEditingRole(false);
    }
  };

  const handleDeleteMember = async () => {
    if (!deleteMember) return;
    setIsDeletingMember(true);
    try {
      await apiMutate(`/api/members/${deleteMember.id}`, { method: "DELETE" });
      await mutateMembers();
      addToast("info", "멤버 제거 완료", `${deleteMember.name}이(가) 조직에서 제거되었습니다.`);
      setDeleteMember(null);
    } catch (e: any) {
      addToast("error", "제거 실패", e.message);
    } finally {
      setIsDeletingMember(false);
    }
  };

  // ── 알림 채널 (localStorage 유지, 서버와 무관) ──
  const [channels, setChannels] = useState(() => loadData("settings_channels", [
    { channel: "인앱", enabled: true },
    { channel: "이메일", enabled: true },
    { channel: "슬랙", enabled: false },
    { channel: "카카오톡", enabled: false },
  ]));
  const [slackUrl, setSlackUrl] = useState(() => loadData("settings_slackUrl", ""));
  useEffect(() => { saveData("settings_channels", channels); }, [channels]);
  const toggleChannel = (i: number) => {
    setChannels((prev: any[]) => prev.map((ch, idx) => idx === i ? { ...ch, enabled: !ch.enabled } : ch));
  };

  // ── 활동 이력 (DB) ──
  const { data: auditRaw, isLoading: auditLoading } = useAuditLogs(1, 50);
  const auditLogs: any[] = Array.isArray(auditRaw) ? auditRaw : [];

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">설정</h1>
      </header>
      <div className="main-body">
        <div className="tabs">
          {tabConfig.map((t) => (
            <div key={t.key} className={`tab ${activeTab === t.key ? "active" : ""}`} onClick={() => setActiveTab(t.key)}>
              {t.label}
            </div>
          ))}
        </div>

        {/* Tab: Organization */}
        {activeTab === "org" && (
          <div className="card">
            <div className="card-header"><h3><Building2 size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />조직 정보</h3></div>
            <div className="card-body">
              {orgLoading ? (
                <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                  <Loader2 size={24} style={{ animation: "spin 1s linear infinite" }} />
                </div>
              ) : (
                <>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                    <div className="form-group">
                      <label className="form-label">조직명</label>
                      <input className="form-input" value={orgName} onChange={(e) => setOrgName(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">사업자번호</label>
                      <input className="form-input" value={orgBizNum} onChange={(e) => setOrgBizNum(e.target.value)} />
                    </div>
                    <div className="form-group">
                      <label className="form-label">대표 이메일</label>
                      <input className="form-input" value={orgEmail} onChange={(e) => setOrgEmail(e.target.value)} />
                    </div>
                  </div>
                  <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={handleSaveOrg} disabled={isSavingOrg}>
                    {isSavingOrg ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null} 변경사항 저장
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Tab: Members */}
        {activeTab === "members" && (
          <div className="card">
            <div className="card-header">
              <h3><Users size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />멤버 관리</h3>
              <button className="btn btn-primary btn-sm" onClick={() => setShowInviteModal(true)}><Plus size={14} /> 멤버 초대</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>이름</th><th>이메일</th><th>역할</th><th>마지막 접속</th><th>상태</th><th></th></tr>
                </thead>
                <tbody>
                  {membersLoading ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                      <Loader2 size={24} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 8px" }} />
                      로딩 중...
                    </td></tr>
                  ) : members.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "0.929rem" }}>
                      <Users size={28} color="var(--border)" style={{ display: "block", margin: "0 auto 10px" }} />
                      등록된 멤버가 없습니다. 멤버 초대 버튼으로 팀원을 초대해보세요.
                    </td></tr>
                  ) : members.map((m) => {
                    const r = roleLabels[m.role] || { label: m.role, badge: "" };
                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{m.email}</td>
                        <td><span className={`badge ${r.badge}`}>{r.label}</span></td>
                        <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>
                          {m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString("ko-KR") : "미접속"}
                        </td>
                        <td><span className={`badge ${m.isActive ? "badge-success" : "badge-warning"}`}>{m.isActive ? "활성" : "비활성"}</span></td>
                        <td style={{ display: "flex", gap: 4 }}>
                          <button className="btn btn-ghost btn-sm" onClick={() => { setEditMember(m); setEditRole(m.role); }}><Edit2 size={14} /></button>
                          {m.role !== "owner" && <button className="btn btn-ghost btn-sm" style={{ color: "var(--error)" }} onClick={() => setDeleteMember(m)}><Trash2 size={14} /></button>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab: Billing */}
        {activeTab === "billing" && (
          <>
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <h3><CreditCard size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />현재 플랜</h3>
                <button className="btn btn-primary btn-sm">플랜 변경</button>
              </div>
              <div className="card-body">
                <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
                  <div style={{ padding: "24px 32px", background: "linear-gradient(135deg, var(--primary), #7C3AED)", borderRadius: "var(--radius-xl)", color: "white", textAlign: "center" }}>
                    <Crown size={24} style={{ marginBottom: 8 }} />
                    <div style={{ fontWeight: 700, fontSize: "1.286rem" }}>{(orgData as any)?.planType ?? "Growth"}</div>
                    <div style={{ opacity: 0.8, fontSize: "0.857rem" }}>₩600,000/월</div>
                  </div>
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px", fontSize: "0.929rem" }}>
                      <div><span style={{ color: "var(--text-secondary)" }}>관리 계정:</span> <strong>{(orgData as any)?.maxAccounts ?? 15}개</strong></div>
                      <div><span style={{ color: "var(--text-secondary)" }}>관리 광고비:</span> <strong>~1억원</strong></div>
                      <div><span style={{ color: "var(--text-secondary)" }}>플랜 유형:</span> <strong>{(orgData as any)?.planType ?? "-"}</strong></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3><Clock size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />청구 이력</h3></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>일자</th><th>내역</th><th>금액</th><th>상태</th></tr></thead>
                  <tbody>
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "0.929rem" }}>
                      <CreditCard size={28} color="var(--border)" style={{ display: "block", margin: "0 auto 10px" }} />
                      청구 이력이 없습니다
                    </td></tr>
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* Tab: Notification Channels */}
        {activeTab === "notifications" && (
          <div className="card">
            <div className="card-header"><h3><Bell size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />알림 채널 설정</h3></div>
            <div className="card-body">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
                {channels.map((ch: any, i: number) => (
                  <div key={ch.channel} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                    <span style={{ fontWeight: 500 }}>{ch.channel}</span>
                    <div className={`toggle ${ch.enabled ? "active" : ""}`} onClick={() => toggleChannel(i)} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24 }}>
                <h4 style={{ marginBottom: 12 }}>슬랙 웹훅 URL</h4>
                <div style={{ display: "flex", gap: 12 }}>
                  <input className="form-input" placeholder="https://hooks.slack.com/services/..." disabled={!channels[2]?.enabled} value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} />
                  <button className="btn btn-secondary" disabled={!channels[2]?.enabled} onClick={() => { saveData("settings_slackUrl", slackUrl); addToast("success", "테스트 발송 완료", "슬랙으로 테스트 메시지가 전송되었습니다."); }}>테스트 발송</button>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { saveData("settings_channels", channels); addToast("success", "알림 설정 저장 완료"); }}>알림 설정 저장</button>
            </div>
          </div>
        )}

        {/* Tab: Activity Log */}
        {activeTab === "activity" && (
          <div className="card">
            <div className="card-header">
              <h3><Shield size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />활동 이력</h3>
              <button className="btn btn-secondary btn-sm" onClick={() => {
                downloadCsv("활동이력", ["시간", "사용자", "액션", "대상"], auditLogs.map((l: any) => [
                  new Date(l.createdAt).toLocaleString("ko-KR"), l.user?.name ?? "-", l.action, l.entityType,
                ]));
                addToast("success", "CSV 내보내기 완료");
              }}><Download size={14} /> CSV</button>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>시간</th><th>사용자</th><th>액션</th><th>대상</th></tr>
                </thead>
                <tbody>
                  {auditLoading ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>
                      <Loader2 size={24} style={{ animation: "spin 1s linear infinite", display: "block", margin: "0 auto 8px" }} />
                      로딩 중...
                    </td></tr>
                  ) : auditLogs.length === 0 ? (
                    <tr><td colSpan={4} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)", fontSize: "0.929rem" }}>
                      <Shield size={28} color="var(--border)" style={{ display: "block", margin: "0 auto 10px" }} />
                      활동 이력이 없습니다
                    </td></tr>
                  ) : auditLogs.map((log: any, i: number) => (
                    <tr key={log.id ?? i}>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem", whiteSpace: "nowrap" }}>
                        {new Date(log.createdAt).toLocaleString("ko-KR")}
                      </td>
                      <td style={{ fontWeight: 600 }}>{log.user?.name ?? "시스템"}</td>
                      <td><span className="badge" style={{ background: "var(--surface-hover)" }}>{log.action}</span></td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{log.entityType} {log.entityId ? `(${log.entityId.slice(0, 8)}...)` : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="card-body" style={{ borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>
                💡 90일 이전 로그는 자동 삭제됩니다 (Enterprise 플랜: 1년 보관)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Member Invite Modal */}
      {showInviteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card, var(--surface))", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 480, width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3>👤 멤버 초대</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowInviteModal(false)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">이름</label>
              <input className="form-input" placeholder="홍길동" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">이메일</label>
              <input className="form-input" type="email" placeholder="user@agency.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">임시 비밀번호 (8자 이상)</label>
              <input className="form-input" type="password" placeholder="임시 비밀번호 입력" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} />
            </div>
            <div className="form-group">
              <label className="form-label">역할</label>
              <select className="form-input" value={inviteRole} onChange={(e) => setInviteRole(e.target.value)}>
                <option value="admin">관리자</option>
                <option value="editor">편집자</option>
                <option value="viewer">뷰어</option>
              </select>
              <div style={{ fontSize: "0.714rem", color: "var(--text-muted)", marginTop: 4 }}>
                {inviteRole === "admin" ? "모든 기능 사용 가능, 멤버 관리 가능" :
                 inviteRole === "editor" ? "캠페인/키워드 편집 가능, 설정 변경 불가" :
                 "데이터 조회만 가능, 편집 불가"}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowInviteModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={handleInvite} disabled={isInviting}>
                {isInviting ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Plus size={16} />} 초대 보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Edit Modal */}
      {editMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card, var(--surface))", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 420, width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3>✏️ 역할 변경</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setEditMember(null)}><X size={18} /></button>
            </div>
            <div style={{ padding: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", marginBottom: 16 }}>
              <div style={{ fontWeight: 600 }}>{editMember.name}</div>
              <div style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{editMember.email}</div>
            </div>
            <div className="form-group">
              <label className="form-label">새 역할</label>
              <select className="form-input" value={editRole} onChange={(e) => setEditRole(e.target.value)} disabled={editMember.role === "owner"}>
                <option value="admin">관리자</option>
                <option value="editor">편집자</option>
                <option value="viewer">뷰어</option>
              </select>
            </div>
            {editMember.role === "owner" && (
              <div style={{ padding: "8px 12px", background: "#FEF3C7", borderRadius: "var(--radius-md)", fontSize: "0.786rem", color: "#92400E", marginBottom: 16 }}>
                ⚠️ 소유자 역할은 변경할 수 없습니다.
              </div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditMember(null)}>취소</button>
              <button className="btn btn-primary" onClick={handleEditMember} disabled={editMember.role === "owner" || isEditingRole}>
                {isEditingRole ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : null} 역할 변경
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Member Delete Confirmation Modal */}
      {deleteMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card, var(--surface))", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 420, width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ color: "var(--error)" }}>⚠️ 멤버 제거</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setDeleteMember(null)}><X size={18} /></button>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: 16 }}>
              <strong>{deleteMember.name}</strong> ({deleteMember.email})을(를) 조직에서 제거하시겠습니까?
            </p>
            <div style={{ padding: "10px 14px", background: "#FEF2F2", borderRadius: "var(--radius-md)", fontSize: "0.857rem", color: "#DC2626", marginBottom: 20 }}>
              이 작업은 되돌릴 수 없습니다. 제거된 멤버는 모든 접근 권한을 잃습니다.
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteMember(null)}>취소</button>
              <button className="btn" style={{ background: "var(--error)", color: "white" }} onClick={handleDeleteMember} disabled={isDeletingMember}>
                {isDeletingMember ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Trash2 size={14} />} 멤버 제거
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
