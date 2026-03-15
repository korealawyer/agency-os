"use client";

import { useState, useMemo } from "react";
import { Download, Filter, Shield, Clock, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { downloadCsv, downloadPdf } from "@/utils/export";
import { useAuditLogs } from "@/hooks/useApi";

type ActionType = "all" | "bid" | "ai" | "setting" | "login" | "report" | "member";
type PeriodFilter = "today" | "7d" | "30d" | "90d";

const actionTypes: Record<string, { label: string; icon: string; badge: string }> = {
  bid: { label: "입찰 변경", icon: "💰", badge: "badge-info" },
  ai: { label: "AI 자동 실행", icon: "🤖", badge: "badge-success" },
  setting: { label: "설정 변경", icon: "⚙️", badge: "badge-warning" },
  login: { label: "로그인/로그아웃", icon: "🔑", badge: "badge-info" },
  report: { label: "리포트 발송", icon: "📋", badge: "badge-success" },
  member: { label: "멤버 관리", icon: "👥", badge: "badge-warning" },
};

const logs = [
  { time: "03/12 10:05", user: "김대행", role: "Admin", type: "bid", target: "KW-001 형사변호사", detail: "입찰가 ₩1,200→₩1,150", ip: "203.xxx.xxx.12" },
  { time: "03/12 09:30", user: "AI", role: "System", type: "ai", target: "15건 키워드", detail: "자동입찰 실행 완료", ip: "-" },
  { time: "03/12 09:00", user: "박마케", role: "Editor", type: "login", target: "-", detail: "로그인", ip: "118.xxx.xxx.45" },
  { time: "03/11 18:22", user: "김대행", role: "Admin", type: "report", target: "RPT-03 A법무법인", detail: "주간 리포트 발송", ip: "203.xxx.xxx.12" },
  { time: "03/11 17:50", user: "김대행", role: "Admin", type: "setting", target: "알림 채널", detail: "Slack 웹훅 URL 변경", ip: "203.xxx.xxx.12" },
  { time: "03/11 15:30", user: "AI", role: "System", type: "ai", target: "E학원 수학학원추천", detail: "시간대 입찰 강화 (15~18시 +20%)", ip: "-" },
  { time: "03/11 15:00", user: "이수석", role: "Owner", type: "member", target: "박마케", detail: "역할 Viewer→Editor 변경", ip: "175.xxx.xxx.67" },
  { time: "03/11 14:30", user: "AI", role: "System", type: "bid", target: "KW-005 임플란트가격", detail: "입찰가 ₩800→₩780", ip: "-" },
  { time: "03/11 12:00", user: "김대행", role: "Admin", type: "setting", target: "컨펌 모드", detail: "Semi Auto→Full Auto 변경", ip: "203.xxx.xxx.12" },
  { time: "03/11 09:05", user: "AI", role: "System", type: "ai", target: "12건 키워드", detail: "자동입찰 실행 완료", ip: "-" },
  { time: "03/10 18:00", user: "김대행", role: "Admin", type: "report", target: "RPT-02 월간종합", detail: "월간 리포트 수동 발송", ip: "203.xxx.xxx.12" },
  { time: "03/10 16:30", user: "박마케", role: "Editor", type: "bid", target: "KW-003 쌍꺼풀수술", detail: "입찰가 ₩2,500→₩2,400", ip: "118.xxx.xxx.45" },
];

const PAGE_SIZE = 8;

export default function AuditLogPage() {
  const [actionFilter, setActionFilter] = useState<ActionType>("all");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("7d");
  const [searchUser, setSearchUser] = useState("");
  const [userFilter, setUserFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const uniqueUsers = useMemo(() => [...new Set(logs.map((l) => l.user))], []);

  const filtered = logs.filter((l) => {
    if (actionFilter !== "all" && l.type !== actionFilter) return false;
    if (userFilter !== "all" && l.user !== userFilter) return false;
    if (searchUser && !l.user.toLowerCase().includes(searchUser.toLowerCase())) return false;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginated = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const handleFilterChange = <T,>(setter: (v: T) => void, value: T) => {
    setter(value);
    setCurrentPage(1);
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">감사 로그 & 활동 이력</h1>
        <div className="main-header-actions">
          <button className="btn btn-secondary" onClick={() => {
            downloadCsv("감사로그", ["시간", "사용자", "역할", "액션", "대상", "변경 내역", "IP"],
              filtered.map((l) => [l.time, l.user, l.role, actionTypes[l.type]?.label || l.type, l.target, l.detail, l.ip]));
          }}><Download size={16} /> CSV 내보내기</button>
          <button className="btn btn-secondary" onClick={() => {
            downloadPdf("감사로그", "감사 로그 보고서",
              [["시간", "사용자", "역할", "액션", "대상", "변경 내역", "IP"],
              ...filtered.map((l) => [l.time, l.user, l.role, actionTypes[l.type]?.label || l.type, l.target, l.detail, l.ip])]);
          }}><Download size={16} /> PDF 내보내기</button>
        </div>
      </header>
      <div className="main-body">
        {/* Filter Bar */}
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", gap: 4, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", padding: 3 }}>
            {([
              { key: "today" as PeriodFilter, label: "오늘" },
              { key: "7d", label: "7일" },
              { key: "30d", label: "30일" },
              { key: "90d", label: "90일" },
            ]).map((p) => (
              <button key={p.key} className={`btn btn-sm ${periodFilter === p.key ? "btn-primary" : "btn-ghost"}`}
                onClick={() => handleFilterChange(setPeriodFilter, p.key as PeriodFilter)}>
                {p.label}
              </button>
            ))}
          </div>

          <div style={{ position: "relative" }}>
            <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: 9 }} />
            <input className="form-input" placeholder="사용자 검색..." style={{ paddingLeft: 28, width: 160, fontSize: "0.857rem" }}
              value={searchUser} onChange={(e) => handleFilterChange(setSearchUser, e.target.value)} />
          </div>

          <select className="form-input" style={{ width: 140, padding: "6px 8px", fontSize: "0.857rem" }}
            value={userFilter} onChange={(e) => handleFilterChange(setUserFilter, e.target.value)}>
            <option value="all">전체 행위자</option>
            {uniqueUsers.map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>

          <select className="form-input" style={{ width: 160, padding: "6px 8px", fontSize: "0.857rem" }}
            value={actionFilter} onChange={(e) => handleFilterChange(setActionFilter, e.target.value as ActionType)}>
            <option value="all">전체 액션</option>
            {Object.entries(actionTypes).map(([key, val]) => (
              <option key={key} value={key}>{val.icon} {val.label}</option>
            ))}
          </select>

          <span style={{ marginLeft: "auto", fontSize: "0.786rem", color: "var(--text-muted)" }}>
            {filtered.length}건 표시 / 전체 {logs.length}건
          </span>
        </div>

        {/* Log Table */}
        <div className="card">
          <div className="table-wrapper">
            <table>
              <thead>
                <tr><th>시간</th><th>사용자</th><th>역할</th><th>액션</th><th>대상</th><th>변경 내역</th><th>IP</th></tr>
              </thead>
              <tbody>
                {paginated.map((log, i) => (
                  <tr key={i}>
                    <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)", whiteSpace: "nowrap" }}>{log.time}</td>
                    <td style={{ fontWeight: log.user === "AI" ? 400 : 600 }}>
                      {log.user === "AI" ? <span className="badge badge-info">🤖 AI</span> : log.user}
                    </td>
                    <td style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>{log.role}</td>
                    <td>
                      <span className={`badge ${actionTypes[log.type]?.badge || "badge-info"}`}>
                        {actionTypes[log.type]?.icon} {actionTypes[log.type]?.label}
                      </span>
                    </td>
                    <td style={{ fontSize: "0.857rem" }}>{log.target}</td>
                    <td style={{ fontWeight: 500, fontSize: "0.857rem" }}>{log.detail}</td>
                    <td style={{ fontFamily: "monospace", fontSize: "0.786rem", color: "var(--text-muted)" }}>{log.ip}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div style={{
              display: "flex", justifyContent: "center", alignItems: "center", gap: 12,
              padding: "12px 16px", borderTop: "1px solid var(--border)",
              fontSize: "0.857rem", color: "var(--text-secondary)"
            }}>
              <button className="btn btn-ghost btn-sm" disabled={safePage <= 1}
                onClick={() => setCurrentPage(safePage - 1)}>
                <ChevronLeft size={14} /> 이전
              </button>
              <span>{safePage} / {totalPages} 페이지</span>
              <button className="btn btn-ghost btn-sm" disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(safePage + 1)}>
                다음 <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Retention Policy Banner */}
        <div style={{
          marginTop: 16, padding: "10px 16px",
          background: "var(--surface)", border: "1px solid var(--border)",
          borderRadius: "var(--radius-lg)",
          display: "flex", justifyContent: "space-between", alignItems: "center",
          fontSize: "0.786rem", color: "var(--text-muted)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Shield size={14} color="var(--primary)" />
            <span>💡 90일 이전 로그는 자동 삭제됩니다 (Enterprise 플랜: 1년 보관)</span>
          </div>
          <span>현재 플랜: Growth · 보관 기간: 90일</span>
        </div>
      </div>
    </>
  );
}
