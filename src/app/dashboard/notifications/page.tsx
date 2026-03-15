"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Check, AlertTriangle, TrendingUp, FileText, Wifi, Info, CheckCheck, Settings } from "lucide-react";
import { useNotifications } from "@/hooks/useApi";

type NotificationType = "all" | "unread" | "urgent" | "bid_change" | "report_sent" | "system";

const notifications = [
  { id: 1, type: "bid_change" as const, priority: "high" as const, title: "A 법률사무소 '형사변호사' 입찰가 변경", message: "AI가 입찰가를 ₩1,200 → ₩1,050으로 조정했습니다. 순위 1위 유지 중.", time: "5분 전", read: false, icon: TrendingUp, color: "var(--warning)" },
  { id: 2, type: "bid_change" as const, priority: "urgent" as const, title: "B 성형외과 CTR 급락 감지", message: "'쌍꺼풀수술가격' 키워드 CTR이 전일 대비 50% 하락했습니다. 소재 점검이 필요합니다.", time: "12분 전", read: false, icon: AlertTriangle, color: "var(--error)" },
  { id: 3, type: "report_sent" as const, priority: "normal" as const, title: "주간 리포트 발송 완료", message: "6개 고객사에 주간 성과 보고서가 자동 발송되었습니다.", time: "1시간 전", read: false, icon: FileText, color: "var(--success)" },
  { id: 4, type: "bid_change" as const, priority: "high" as const, title: "C 치과의원 일예산 90% 소진", message: "현재 15:00 기준으로 일예산의 90%가 소진되었습니다. 오후 광고 노출이 제한될 수 있습니다.", time: "2시간 전", read: true, icon: AlertTriangle, color: "var(--warning)" },
  { id: 5, type: "system" as const, priority: "normal" as const, title: "D 부동산 API 연결 오류", message: "네이버 API 연결이 끊어졌습니다. 자동 재연결을 시도하고 있습니다.", time: "3시간 전", read: true, icon: Wifi, color: "var(--error)" },
  { id: 6, type: "bid_change" as const, priority: "normal" as const, title: "E 학원 '수학학원추천' 입찰 최적화 완료", message: "시간대 차등 전략에 의해 15~18시 입찰가가 +20% 상향 적용되었습니다.", time: "4시간 전", read: true, icon: TrendingUp, color: "var(--info)" },
  { id: 7, type: "system" as const, priority: "low" as const, title: "시스템 업데이트 안내", message: "Agency OS v1.0.3 업데이트가 적용되었습니다. AI 입찰 정확도가 개선되었습니다.", time: "어제", read: true, icon: Info, color: "var(--text-muted)" },
];

const tabs: { key: NotificationType; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "unread", label: "미읽음" },
  { key: "urgent", label: "긴급" },
  { key: "bid_change", label: "입찰 변경" },
  { key: "report_sent", label: "리포트" },
  { key: "system", label: "시스템" },
];

const notifSettings = [
  { type: "자동입찰 변경", inapp: true, email: true, slack: false, kakao: false },
  { type: "예산 알림", inapp: true, email: true, slack: false, kakao: true },
  { type: "리포트 발송", inapp: true, email: false, slack: false, kakao: false },
  { type: "API 오류", inapp: true, email: true, slack: true, kakao: false },
  { type: "시스템 공지", inapp: true, email: false, slack: false, kakao: false },
];

export default function NotificationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<NotificationType>("all");
  const [readState, setReadState] = useState<Record<number, boolean>>(() =>
    Object.fromEntries(notifications.map((n) => [n.id, n.read]))
  );
  const [showSettings, setShowSettings] = useState(false);
  const [settings, setSettings] = useState(notifSettings);

  const unreadCount = Object.values(readState).filter((v) => !v).length;

  const filtered = notifications.filter((n) => {
    if (activeTab === "all") return true;
    if (activeTab === "unread") return !readState[n.id];
    if (activeTab === "urgent") return n.priority === "urgent" || n.priority === "high";
    return n.type === activeTab;
  });

  const markAllRead = () => {
    const next = { ...readState };
    notifications.forEach((n) => { next[n.id] = true; });
    setReadState(next);
  };

  const markRead = (id: number) => {
    setReadState((prev) => ({ ...prev, [id]: true }));
  };

  const toggleSetting = (idx: number, channel: "inapp" | "email" | "slack" | "kakao") => {
    setSettings((prev) => prev.map((s, i) => i === idx ? { ...s, [channel]: !s[channel] } : s));
  };

  // Deep link mapping for notification types
  const getDeepLink = (type: string): string => {
    switch (type) {
      case "bid_change": return "/dashboard/keywords";
      case "report_sent": return "/dashboard/reports";
      case "system": return "/dashboard/settings";
      default: return "/dashboard";
    }
  };

  const handleNotificationClick = (n: typeof notifications[0]) => {
    markRead(n.id);
    router.push(getDeepLink(n.type));
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">알림 센터</h1>
        <div className="main-header-actions">
          <span className="badge badge-info">{unreadCount}건 미읽음</span>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings size={14} /> {showSettings ? "알림 목록" : "알림 설정"}
          </button>
          <button className="btn btn-secondary btn-sm" onClick={markAllRead}>
            <CheckCheck size={14} /> 전체 읽음 처리
          </button>
        </div>
      </header>
      <div className="main-body">
        {showSettings ? (
          <div className="card">
            <div className="card-header">
              <h3><Bell size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />유형별 알림 설정</h3>
            </div>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>알림 유형</th>
                    <th style={{ textAlign: "center" }}>인앱</th>
                    <th style={{ textAlign: "center" }}>이메일</th>
                    <th style={{ textAlign: "center" }}>슬랙</th>
                    <th style={{ textAlign: "center" }}>카카오톡</th>
                  </tr>
                </thead>
                <tbody>
                  {settings.map((s, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 600 }}>{s.type}</td>
                      {(["inapp", "email", "slack", "kakao"] as const).map((ch) => (
                        <td key={ch} style={{ textAlign: "center" }}>
                          <div
                            className={`toggle ${s[ch] ? "active" : ""}`}
                            style={{ margin: "0 auto" }}
                            onClick={() => toggleSetting(i, ch)}
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <>
            <div className="tabs">
              {tabs.map((t) => (
                <div
                  key={t.key}
                  className={`tab ${activeTab === t.key ? "active" : ""}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {t.label}
                  {t.key === "unread" && unreadCount > 0 ? ` (${unreadCount})` : ""}
                </div>
              ))}
            </div>

            {filtered.length === 0 ? (
              <div className="card" style={{ padding: 48, textAlign: "center" }}>
                <Bell size={32} color="var(--text-muted)" />
                <p style={{ marginTop: 12, color: "var(--text-secondary)" }}>해당 알림이 없습니다</p>
              </div>
            ) : (
              <div className="card">
                {filtered.map((n) => {
                  const Icon = n.icon;
                  const isUnread = !readState[n.id];
                  return (
                    <div key={n.id} className={`notification-item ${isUnread ? "unread" : ""}`} onClick={() => handleNotificationClick(n)} style={{ cursor: "pointer" }}>
                      <div className="notification-dot" style={{ background: n.color }} />
                      <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: `${n.color}15`, color: n.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <Icon size={18} />
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <strong style={{ fontSize: "0.929rem" }}>{n.title}</strong>
                          <span style={{ fontSize: "0.714rem", color: "var(--text-muted)", flexShrink: 0 }}>{n.time}</span>
                        </div>
                        <p style={{ fontSize: "0.857rem", color: "var(--text-secondary)", marginTop: 4 }}>{n.message}</p>
                      </div>
                      {isUnread && (
                        <button className="btn btn-ghost btn-sm" onClick={() => markRead(n.id)}>
                          <Check size={14} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
