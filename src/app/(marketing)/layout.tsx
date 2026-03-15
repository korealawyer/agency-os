"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Sparkles, Menu, X } from "lucide-react";
import { useState } from "react";

const navLinks = [
  { href: "/landing", label: "기능" },
  { href: "/pricing", label: "가격" },
  { href: "/demo", label: "데모" },
  { href: "/roi-calculator", label: "ROI 계산기" },
];

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="marketing-layout">
      {/* Sticky Navigation */}
      <header className="marketing-nav">
        <div className="marketing-nav-inner">
          <Link href="/landing" className="marketing-logo">
            <Sparkles size={24} />
            <span>Agency OS</span>
          </Link>
          <nav className="marketing-nav-links">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`marketing-nav-link ${pathname === link.href ? "active" : ""}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="marketing-nav-actions">
            <Link href="/login" className="btn btn-ghost marketing-desktop-only">로그인</Link>
            <Link href="/login?view=signup" className="btn btn-primary hero-cta-primary marketing-desktop-only">14일 무료 체험</Link>
            <button
              className="marketing-hamburger"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="메뉴"
            >
              {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="marketing-mobile-overlay" onClick={() => setMobileMenuOpen(false)}>
          <div className="marketing-mobile-menu" onClick={(e) => e.stopPropagation()}>
            <nav>
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`marketing-mobile-link ${pathname === link.href ? "active" : ""}`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 16, display: "flex", flexDirection: "column", gap: 8 }}>
              <Link href="/login" className="btn btn-secondary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setMobileMenuOpen(false)}>
                로그인
              </Link>
              <Link href="/login?view=signup" className="btn btn-primary hero-cta-primary" style={{ width: "100%", justifyContent: "center" }} onClick={() => setMobileMenuOpen(false)}>
                14일 무료 체험
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <main>{children}</main>

      {/* Footer */}
      <footer className="marketing-footer">
        <div className="marketing-footer-inner">
          <div className="marketing-footer-grid">
            <div>
              <div className="marketing-logo" style={{ marginBottom: 16 }}>
                <Sparkles size={20} />
                <span>Agency OS</span>
              </div>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.857rem", maxWidth: 280 }}>
                네이버 검색광고 대행사를 위한 AI 기반 통합 관리 플랫폼. 
                30개 계정을 한 화면에서 관리하세요.
              </p>
            </div>
            <div>
              <h4 className="marketing-footer-title">제품</h4>
              <Link href="/landing" className="marketing-footer-link">기능 소개</Link>
              <Link href="/pricing" className="marketing-footer-link">가격</Link>
              <Link href="/roi-calculator" className="marketing-footer-link">ROI 계산기</Link>
              <Link href="/demo" className="marketing-footer-link">데모</Link>
            </div>
            <div>
              <h4 className="marketing-footer-title">지원</h4>
              <a href="#" className="marketing-footer-link">도움말 센터</a>
              <a href="#" className="marketing-footer-link">API 문서</a>
              <a href="#" className="marketing-footer-link">상태 페이지</a>
              <a href="mailto:support@agencyos.kr" className="marketing-footer-link">support@agencyos.kr</a>
            </div>
            <div>
              <h4 className="marketing-footer-title">법적 고지</h4>
              <a href="#" className="marketing-footer-link">이용약관</a>
              <a href="#" className="marketing-footer-link">개인정보처리방침</a>
              <a href="#" className="marketing-footer-link">사업자 정보</a>
            </div>
          </div>
          <div className="marketing-footer-bottom">
            <p>© 2026 Agency OS. All rights reserved.</p>
            <p>사업자 정보는 서비스 런칭 시 공개됩니다.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

