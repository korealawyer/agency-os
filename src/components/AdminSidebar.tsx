'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard, Building2, Users, CreditCard, Link2, TrendingUp,
  RefreshCw, Bot, FileText, ShieldAlert, Server, Lock, ClipboardList,
  Megaphone, Settings, BarChart3,
} from 'lucide-react';

const menuItems = [
  { href: '/admin', label: '관리자 홈', icon: LayoutDashboard },
  { href: '/admin/organizations', label: '조직 관리', icon: Building2 },
  { href: '/admin/users', label: '사용자 관리', icon: Users },
  { href: '/admin/subscriptions', label: '구독 관리', icon: CreditCard },
  { href: '/admin/naver-accounts', label: '네이버 계정', icon: Link2 },
  { href: '/admin/profitability', label: '수익성 관리', icon: TrendingUp },
  { href: '/admin/data-sync', label: '데이터 동기화', icon: RefreshCw },
  { href: '/admin/ai-monitoring', label: 'AI 모니터링', icon: Bot },
  { href: '/admin/reports', label: '리포트 관리', icon: FileText },
  { href: '/admin/click-fraud', label: '부정클릭', icon: ShieldAlert },
  { href: '/admin/system', label: '시스템 상태', icon: Server },
  { href: '/admin/security', label: '보안', icon: Lock },
  { href: '/admin/audit', label: '감사 로그', icon: ClipboardList },
  { href: '/admin/announcements', label: '공지사항', icon: Megaphone },
  { href: '/admin/plan-config', label: '플랜 설정', icon: Settings },
  { href: '/admin/analytics', label: '플랫폼 분석', icon: BarChart3 },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside style={{
      width: 260, position: 'fixed', top: 0, left: 0, height: '100vh',
      background: 'linear-gradient(180deg, #0f0f1a 0%, #0a0a12 100%)',
      borderRight: '1px solid rgba(124,92,252,0.15)',
      display: 'flex', flexDirection: 'column', zIndex: 50,
      overflowY: 'auto',
    }}>
      {/* Logo Area */}
      <div style={{
        padding: '20px 20px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <Link href="/admin" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #7c5cfc, #c084fc)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16, fontWeight: 700, color: '#fff',
          }}>A</div>
          <div>
            <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>Agency OS</div>
            <div style={{ color: '#7c5cfc', fontSize: 11, fontWeight: 500 }}>System Admin</div>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {menuItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || (href !== '/admin' && pathname?.startsWith(href));
          return (
            <Link key={href} href={href} style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '10px 12px', borderRadius: 8, textDecoration: 'none',
              fontSize: 13, fontWeight: isActive ? 600 : 400,
              color: isActive ? '#fff' : '#888',
              background: isActive ? 'rgba(124,92,252,0.15)' : 'transparent',
              borderLeft: isActive ? '3px solid #7c5cfc' : '3px solid transparent',
              transition: 'all 0.15s ease',
            }}>
              <Icon size={16} style={{ opacity: isActive ? 1 : 0.6, color: isActive ? '#7c5cfc' : '#888' }} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.06)',
        fontSize: 11, color: '#555', textAlign: 'center',
      }}>
        <Link href="/dashboard" style={{ color: '#7c5cfc', textDecoration: 'none', fontSize: 12 }}>
          ← 대시보드로 돌아가기
        </Link>
      </div>
    </aside>
  );
}
