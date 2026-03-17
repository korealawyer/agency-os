"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, BarChart3, KeyRound, Zap,
  FileText, TrendingUp, Bell, Settings, Sparkles,
  DollarSign, Eye, Shield, ShieldAlert, Bot, LogOut,
  Menu, X, Megaphone, ChevronDown,
} from "lucide-react";
import { useState, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";

// ── 섹션 정의 (순서 고정, 각 섹션에 기본 열림 여부 포함) ──
const NAV_SECTIONS = [
  {
    key: "메인",
    emoji: "🏠",
    defaultOpen: true,
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "홈" },
      { href: "/dashboard/accounts", icon: Users, label: "계정 관리" },
    ],
  },
  {
    key: "광고 관리",
    emoji: "📊",
    defaultOpen: true,
    items: [
      { href: "/dashboard/campaigns", icon: BarChart3, label: "캠페인" },
      { href: "/dashboard/keywords", icon: KeyRound, label: "키워드" },
      { href: "/dashboard/ads", icon: Megaphone, label: "소재" },
    ],
  },
  {
    key: "AI 도구",
    emoji: "🤖",
    defaultOpen: true,
    items: [
      { href: "/dashboard/automation", icon: Zap, label: "자동화" },
      { href: "/dashboard/copilot", icon: Bot, label: "AI 코파일럿", badge: "NEW" },
      { href: "/dashboard/reports", icon: FileText, label: "리포트" },
    ],
  },
  {
    key: "분석",
    emoji: "📈",
    defaultOpen: false,
    items: [
      { href: "/dashboard/profitability", icon: DollarSign, label: "수익성" },
      { href: "/dashboard/competitive", icon: Eye, label: "경쟁 분석" },
      { href: "/dashboard/simulator", icon: TrendingUp, label: "시뮬레이터" },
    ],
  },
  {
    key: "시스템",
    emoji: "⚙️",
    defaultOpen: false,
    items: [
      { href: "/dashboard/notifications", icon: Bell, label: "알림" },
      { href: "/dashboard/settings", icon: Settings, label: "설정" },
      { href: "/dashboard/audit-log", icon: Shield, label: "감사 로그" },
      { href: "/dashboard/click-fraud", icon: ShieldAlert, label: "부정클릭" },
    ],
  },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { data: session } = useSession();
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // 각 섹션의 열림 상태 (기본값으로 초기화)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(NAV_SECTIONS.map((s) => [s.key, s.defaultOpen]))
  );

  useEffect(() => {
    // 현재 활성 경로가 포함된 섹션은 자동으로 열기
    NAV_SECTIONS.forEach((sec) => {
      const hasActive = sec.items.some((item) =>
        item.href === "/dashboard"
          ? pathname === "/dashboard"
          : pathname.startsWith(item.href)
      );
      if (hasActive) {
        setOpenSections((prev) => ({ ...prev, [sec.key]: true }));
      }
    });
  }, [pathname]);

  const toggleSection = (key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleLogout = () => {
    signOut({ callbackUrl: "/login" });
  };

  const userName = session?.user?.name || "사용자";
  const userRole = (session?.user as any)?.role || "editor";

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <Sparkles size={24} color="var(--primary)" />
        <h2>Agency OS</h2>
      </div>

      <nav className="sidebar-nav">
        {NAV_SECTIONS.map((section) => {
          const isOpen = openSections[section.key];
          // 섹션 내 활성 항목 여부 확인
          const hasSectionActive = section.items.some((item) =>
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href)
          );

          return (
            <div key={section.key} className="nav-accordion">
              {/* 섹션 헤더 (클릭 시 접기/펼치기) */}
              <button
                className={`nav-accordion-header ${hasSectionActive ? "has-active" : ""}`}
                onClick={() => toggleSection(section.key)}
                aria-expanded={isOpen}
              >
                <span className="nav-accordion-emoji">{section.emoji}</span>
                <span className="nav-accordion-label">{section.key}</span>
                <ChevronDown
                  size={14}
                  className={`nav-accordion-chevron ${isOpen ? "open" : ""}`}
                />
              </button>

              {/* 섹션 아이템들 (아코디언 열/닫) */}
              <div className={`nav-accordion-body ${isOpen ? "open" : ""}`}>
                {section.items.map((item) => {
                  const Icon = item.icon;
                  const isActive =
                    item.href === "/dashboard"
                      ? pathname === "/dashboard"
                      : pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`nav-item nav-item-indented ${isActive ? "active" : ""}`}
                      onClick={() => setMobileOpen(false)}
                    >
                      <Icon size={16} />
                      <span>{item.label}</span>
                      {"badge" in item && item.badge && (
                        <span className="nav-badge">{item.badge}</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{userName[0]}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{userName}</div>
          <div className="sidebar-user-role">
            {userRole === "owner" ? "소유자" : userRole === "admin" ? "관리자" : userRole === "editor" ? "에디터" : "뷰어"}
          </div>
        </div>
        <button
          onClick={() => setShowLogoutConfirm(true)}
          title="로그아웃"
          style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, marginLeft: "auto", borderRadius: "var(--radius-md)", transition: "all 0.2s" }}
        >
          <LogOut size={16} />
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="sidebar sidebar-desktop">
        {sidebarContent}
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="mobile-tabbar">
        {[
          { href: "/dashboard", icon: LayoutDashboard, label: "홈" },
          { href: "/dashboard/keywords", icon: KeyRound, label: "키워드" },
          { href: "/dashboard/copilot", icon: Bot, label: "AI" },
          { href: "/dashboard/reports", icon: FileText, label: "리포트" },
          { href: "#menu", icon: Menu, label: "더보기" },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = item.href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(item.href);
          if (item.href === "#menu") {
            return (
              <button key="menu" className={`mobile-tab ${mobileOpen ? "active" : ""}`} onClick={() => setMobileOpen(!mobileOpen)}>
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
                <span>{mobileOpen ? "닫기" : item.label}</span>
              </button>
            );
          }
          return (
            <Link key={item.href} href={item.href} className={`mobile-tab ${isActive ? "active" : ""}`} onClick={() => setMobileOpen(false)}>
              <Icon size={20} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Mobile Full Menu Overlay */}
      {mobileOpen && (
        <div className="mobile-menu-overlay" onClick={() => setMobileOpen(false)}>
          <div className="mobile-menu-panel" onClick={(e) => e.stopPropagation()}>
            {sidebarContent}
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card, var(--surface))", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 400, width: "90%", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ textAlign: "center", marginBottom: 20 }}>
              <LogOut size={32} color="var(--text-muted)" style={{ marginBottom: 12 }} />
              <h3 style={{ fontSize: "1.143rem", marginBottom: 8 }}>로그아웃 하시겠습니까?</h3>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>
                로그아웃하면 대시보드 접근이 제한됩니다.
              </p>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowLogoutConfirm(false)}>
                취소
              </button>
              <button className="btn" style={{ flex: 1, background: "var(--error)", color: "white" }} onClick={handleLogout}>
                <LogOut size={14} /> 로그아웃
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
