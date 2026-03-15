"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, Users, BarChart3, KeyRound, Zap,
  FileText, TrendingUp, Bell, Settings, Sparkles,
  DollarSign, Eye, Shield, ShieldAlert, Bot, LogOut, Menu, X, Megaphone
} from "lucide-react";
import { useState, useEffect } from "react";
import { logout, getCurrentUser, type User } from "@/utils/auth";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "홈", section: "메인" },
  { href: "/dashboard/accounts", icon: Users, label: "계정 관리", section: "메인" },
  { href: "/dashboard/campaigns", icon: BarChart3, label: "캠페인", section: "관리" },
  { href: "/dashboard/keywords", icon: KeyRound, label: "키워드", section: "관리" },
  { href: "/dashboard/ads", icon: Megaphone, label: "소재", section: "관리" },
  { href: "/dashboard/automation", icon: Zap, label: "자동화", section: "AI" },
  { href: "/dashboard/copilot", icon: Bot, label: "AI 코파일럿", section: "AI" },
  { href: "/dashboard/reports", icon: FileText, label: "리포트", section: "AI" },
  { href: "/dashboard/profitability", icon: DollarSign, label: "수익성", section: "분석" },
  { href: "/dashboard/competitive", icon: Eye, label: "경쟁", section: "분석" },
  { href: "/dashboard/simulator", icon: TrendingUp, label: "시뮬레이터", section: "도구" },
  { href: "/dashboard/notifications", icon: Bell, label: "알림", section: "도구" },
  { href: "/dashboard/settings", icon: Settings, label: "설정", section: "시스템" },
  { href: "/dashboard/audit-log", icon: Shield, label: "감사 로그", section: "시스템" },
  { href: "/dashboard/click-fraud", icon: ShieldAlert, label: "부정클릭", section: "시스템" },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    setUser(getCurrentUser());
  }, []);

  const sections = navItems.reduce<Record<string, typeof navItems>>((acc, item) => {
    if (!acc[item.section]) acc[item.section] = [];
    acc[item.section].push(item);
    return acc;
  }, {});

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  const sidebarContent = (
    <>
      <div className="sidebar-logo">
        <Sparkles size={24} color="#1E40AF" />
        <h2>Agency OS</h2>
      </div>

      <nav className="sidebar-nav">
        {Object.entries(sections).map(([section, items]) => (
          <div key={section}>
            <div className="nav-section-title">{section}</div>
            {items.map((item) => {
              const Icon = item.icon;
              const isActive =
                item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-item ${isActive ? "active" : ""}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon size={20} />
                  <span>{item.label}</span>
                  {item.href === "/dashboard/copilot" && (
                    <span style={{ marginLeft: "auto", fontSize: "0.643rem", background: "var(--primary)", color: "white", padding: "1px 6px", borderRadius: 8, fontWeight: 600 }}>NEW</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-avatar">{user?.name?.[0] || "김"}</div>
        <div className="sidebar-user-info">
          <div className="sidebar-user-name">{user?.name || "김대행"}</div>
          <div className="sidebar-user-role">{user?.role === "owner" ? "소유자" : user?.role === "admin" ? "관리자" : "Agency"}</div>
        </div>
        <button onClick={() => setShowLogoutConfirm(true)} title="로그아웃" style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", padding: 4, marginLeft: "auto", borderRadius: "var(--radius-md)", transition: "all 0.2s" }}>
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
          <div style={{ background: "#fff", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 400, width: "90%", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
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

