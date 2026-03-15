"use client";

import { useState, useEffect } from "react";
import {
  Building2, Users, CreditCard, Bell, Shield, Trash2, Plus,
  Crown, Edit2, Clock, Download, Key, X,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { downloadCsv } from "@/utils/export";
import { saveData, loadData } from "@/utils/storage";

type SettingsTab = "org" | "members" | "billing" | "notifications" | "activity";

const tabConfig: { key: SettingsTab; label: string; icon: typeof Building2 }[] = [
  { key: "org", label: "조직 관리", icon: Building2 },
  { key: "members", label: "멤버 & 권한", icon: Users },
  { key: "billing", label: "결제 & 구독", icon: CreditCard },
  { key: "notifications", label: "알림 채널", icon: Bell },
  { key: "activity", label: "활동 이력", icon: Shield },
];

type MemberType = { name: string; email: string; role: string; lastLogin: string; status: string };

const initialMembers: MemberType[] = [
  { name: "김대행", email: "kim@agency.com", role: "owner", lastLogin: "오늘 09:00", status: "active" },
  { name: "이마케터", email: "lee@agency.com", role: "admin", lastLogin: "오늘 10:30", status: "active" },
  { name: "박실무", email: "park@agency.com", role: "editor", lastLogin: "어제 18:00", status: "active" },
  { name: "최뷰어", email: "choi@agency.com", role: "viewer", lastLogin: "3일 전", status: "active" },
];

const roleLabels: Record<string, { label: string; badge: string }> = {
  owner: { label: "소유자", badge: "badge-info" },
  admin: { label: "관리자", badge: "badge-success" },
  editor: { label: "편집자", badge: "badge-warning" },
  viewer: { label: "뷰어", badge: "" },
};

const activityLogs = [
  { time: "03/12 16:05", user: "김대행", role: "소유자", action: "입찰가 변경", target: "형사변호사 ₩1,200→₩1,050", icon: "💰" },
  { time: "03/12 15:30", user: "AI", role: "자동화", action: "자동입찰 실행", target: "15건 키워드", icon: "🤖" },
  { time: "03/12 14:00", user: "이마케터", role: "관리자", action: "리포트 발송", target: "A 법률사무소 주간 보고서", icon: "📋" },
  { time: "03/12 09:30", user: "박실무", role: "편집자", action: "키워드 추가", target: "'개인회생변호사' 외 2건", icon: "🔑" },
  { time: "03/12 09:00", user: "김대행", role: "소유자", action: "로그인", target: "IP: 118.xxx.xxx.xxx", icon: "🔒" },
  { time: "03/11 18:22", user: "김대행", role: "소유자", action: "설정 변경", target: "알림 채널 — 슬랙 활성화", icon: "⚙️" },
  { time: "03/11 17:50", user: "AI", role: "자동화", action: "자동입찰 실행", target: "23건 키워드", icon: "🤖" },
  { time: "03/11 14:10", user: "이마케터", role: "관리자", action: "캠페인 생성", target: "B 성형외과 — 코성형 캠페인", icon: "📊" },
];

const billingHistory = [
  { date: "2026-03-01", desc: "Growth 플랜 — 3월 정기결제", amount: "₩600,000", status: "완료" },
  { date: "2026-02-01", desc: "Growth 플랜 — 2월 정기결제", amount: "₩600,000", status: "완료" },
  { date: "2026-01-01", desc: "Growth 플랜 — 1월 정기결제", amount: "₩600,000", status: "완료" },
];

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("org");
  const [channels, setChannels] = useState(() => loadData("settings_channels", [
    { channel: "인앱", enabled: true },
    { channel: "이메일", enabled: true },
    { channel: "슬랙", enabled: false },
    { channel: "카카오톡", enabled: false },
  ]));
  const [members, setMembers] = useState(() => loadData("settings_members", initialMembers));
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviteRole, setInviteRole] = useState("editor");
  const [editMember, setEditMember] = useState<MemberType | null>(null);
  const [editRole, setEditRole] = useState("");
  const [deleteMember, setDeleteMember] = useState<MemberType | null>(null);
  const [orgName, setOrgName] = useState(() => loadData("settings_orgName", "안티그래비티 마케팅"));
  const [orgBizNum, setOrgBizNum] = useState(() => loadData("settings_orgBizNum", "123-45-67890"));
  const [orgEmail, setOrgEmail] = useState(() => loadData("settings_orgEmail", "contact@agency.com"));
  const [orgPhone, setOrgPhone] = useState(() => loadData("settings_orgPhone", "02-1234-5678"));
  const [slackUrl, setSlackUrl] = useState(() => loadData("settings_slackUrl", ""));
  const { addToast } = useToast();

  // Persist settings changes
  useEffect(() => { saveData("settings_channels", channels); }, [channels]);
  useEffect(() => { saveData("settings_members", members); }, [members]);

  const toggleChannel = (i: number) => {
    setChannels((prev) => prev.map((ch, idx) => idx === i ? { ...ch, enabled: !ch.enabled } : ch));
  };

  const handleInvite = () => {
    if (!inviteEmail.trim() || !inviteName.trim()) {
      addToast("error", "이름과 이메일을 모두 입력해주세요");
      return;
    }
    setMembers((prev) => [...prev, {
      name: inviteName, email: inviteEmail, role: inviteRole,
      lastLogin: "초대 대기중", status: "pending",
    }]);
    addToast("success", "멤버 초대 완료", `${inviteName}(${inviteEmail})에게 초대 메일이 발송되었습니다.`);
    setInviteEmail(""); setInviteName(""); setInviteRole("editor");
    setShowInviteModal(false);
  };

  const handleEditMember = () => {
    if (!editMember) return;
    setMembers((prev) => prev.map((m) => m.email === editMember.email ? { ...m, role: editRole } : m));
    addToast("success", "역할 변경 완료", `${editMember.name}의 역할이 ${roleLabels[editRole]?.label || editRole}(으)로 변경되었습니다.`);
    setEditMember(null);
  };

  const handleDeleteMember = () => {
    if (!deleteMember) return;
    setMembers((prev) => prev.filter((m) => m.email !== deleteMember.email));
    addToast("info", "멤버 제거 완료", `${deleteMember.name}이(가) 조직에서 제거되었습니다.`);
    setDeleteMember(null);
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">설정</h1>
      </header>
      <div className="main-body">
        <div className="tabs">
          {tabConfig.map((t) => (
            <div
              key={t.key}
              className={`tab ${activeTab === t.key ? "active" : ""}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </div>
          ))}
        </div>

        {/* Tab: Organization */}
        {activeTab === "org" && (
          <div className="card">
            <div className="card-header"><h3><Building2 size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />조직 정보</h3></div>
            <div className="card-body">
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
                <div className="form-group">
                  <label className="form-label">연락처</label>
                  <input className="form-input" value={orgPhone} onChange={(e) => setOrgPhone(e.target.value)} />
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={() => { saveData("settings_orgName", orgName); saveData("settings_orgBizNum", orgBizNum); saveData("settings_orgEmail", orgEmail); saveData("settings_orgPhone", orgPhone); addToast("success", "조직 정보 저장 완료", "변경사항이 저장되었습니다."); }}>변경사항 저장</button>
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
                  {members.map((m) => {
                    const r = roleLabels[m.role] || { label: m.role, badge: "" };
                    return (
                      <tr key={m.email}>
                        <td style={{ fontWeight: 600 }}>{m.name}</td>
                        <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{m.email}</td>
                        <td><span className={`badge ${r.badge}`}>{r.label}</span></td>
                        <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{m.lastLogin}</td>
                        <td><span className={`badge ${m.status === "active" ? "badge-success" : "badge-warning"}`}>{m.status === "active" ? "활성" : "초대 대기"}</span></td>
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
                    <div style={{ fontWeight: 700, fontSize: "1.286rem" }}>Growth</div>
                    <div style={{ opacity: 0.8, fontSize: "0.857rem" }}>₩600,000/월</div>
                  </div>
                  <div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 32px", fontSize: "0.929rem" }}>
                      <div><span style={{ color: "var(--text-secondary)" }}>관리 계정:</span> <strong>15개</strong></div>
                      <div><span style={{ color: "var(--text-secondary)" }}>관리 광고비:</span> <strong>~1억원</strong></div>
                      <div><span style={{ color: "var(--text-secondary)" }}>다음 결제일:</span> <strong>2026-04-01</strong></div>
                      <div><span style={{ color: "var(--text-secondary)" }}>결제 수단:</span> <strong>카드 ****-1234</strong></div>
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
                    {billingHistory.map((b, i) => (
                      <tr key={i}>
                        <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{b.date}</td>
                        <td style={{ fontWeight: 600 }}>{b.desc}</td>
                        <td style={{ fontWeight: 600 }}>{b.amount}</td>
                        <td><span className="badge badge-success">{b.status}</span></td>
                      </tr>
                    ))}
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
                {channels.map((ch, i) => (
                  <div key={ch.channel} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)" }}>
                    <span style={{ fontWeight: 500 }}>{ch.channel}</span>
                    <div
                      className={`toggle ${ch.enabled ? "active" : ""}`}
                      onClick={() => toggleChannel(i)}
                    />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 24 }}>
                <h4 style={{ marginBottom: 12 }}>슬랙 웹훅 URL</h4>
                <div style={{ display: "flex", gap: 12 }}>
                  <input className="form-input" placeholder="https://hooks.slack.com/services/..." disabled={!channels[2].enabled} value={slackUrl} onChange={(e) => setSlackUrl(e.target.value)} />
                  <button className="btn btn-secondary" disabled={!channels[2].enabled} onClick={() => { saveData("settings_slackUrl", slackUrl); addToast("success", "테스트 발송 완료", "슬랙으로 테스트 메시지가 전송되었습니다."); }}>테스트 발송</button>
                </div>
              </div>
              <button className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => { saveData("settings_channels", channels); addToast("success", "알림 설정 저장 완료", "알림 채널 설정이 저장되었습니다."); }}>알림 설정 저장</button>
            </div>
          </div>
        )}

        {/* Tab: Activity Log */}
        {activeTab === "activity" && (
          <div className="card">
            <div className="card-header">
              <h3><Shield size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />활동 이력</h3>
              <div style={{ display: "flex", gap: 8 }}>
                <select className="form-input" style={{ width: 160, padding: "6px 12px" }}>
                  <option>최근 7일</option>
                  <option>최근 30일</option>
                  <option>최근 90일</option>
                </select>
                <button className="btn btn-secondary btn-sm" onClick={() => { downloadCsv("활동이력", ["시간", "사용자", "역할", "액션", "대상"], activityLogs.map((l) => [l.time, l.user, l.role, l.action, l.target])); addToast("success", "CSV 내보내기 완료", "활동 이력이 다운로드되었습니다."); }}><Download size={14} /> CSV</button>
              </div>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>시간</th><th>사용자</th><th>역할</th><th>액션</th><th>대상</th></tr>
                </thead>
                <tbody>
                  {activityLogs.map((log, i) => (
                    <tr key={i}>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem", whiteSpace: "nowrap" }}>{log.time}</td>
                      <td style={{ fontWeight: 600 }}>{log.icon} {log.user}</td>
                      <td><span className="badge" style={{ background: "var(--surface-hover)" }}>{log.role}</span></td>
                      <td>{log.action}</td>
                      <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{log.target}</td>
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

      {/* B-9: Member Invite Modal */}
      {showInviteModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 480, width: "100%", boxShadow: "var(--shadow-xl)" }}>
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
              <button className="btn btn-primary" onClick={handleInvite}>
                <Plus size={16} /> 초대 보내기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* B-10a: Member Edit Modal */}
      {editMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 420, width: "100%", boxShadow: "var(--shadow-xl)" }}>
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
              <button className="btn btn-primary" onClick={handleEditMember} disabled={editMember.role === "owner"}>역할 변경</button>
            </div>
          </div>
        </div>
      )}

      {/* B-10b: Member Delete Confirmation Modal */}
      {deleteMember && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 420, width: "100%", boxShadow: "var(--shadow-xl)" }}>
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
              <button className="btn" style={{ background: "var(--error)", color: "white" }} onClick={handleDeleteMember}>
                <Trash2 size={14} /> 멤버 제거
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
