"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Sparkles, Zap, Shield, Users, BarChart3, Bot, ArrowRight } from "lucide-react";

type PlanKey = "starter" | "growth" | "scale" | "enterprise";

interface Plan {
  key: PlanKey;
  name: string;
  price: string;
  priceNum: number;
  period: string;
  desc: string;
  badge?: string;
  features: string[];
  accounts: string;
  cta: string;
  highlight?: boolean;
}

const plans: Plan[] = [
  {
    key: "starter",
    name: "스타터",
    price: "₩99,000",
    priceNum: 99000,
    period: "/월",
    desc: "소규모 대행사를 위한 기본 플랜",
    accounts: "광고 계정 3개",
    features: [
      "네이버 광고 계정 연동 (3개)",
      "캠페인/키워드 관리",
      "기본 대시보드",
      "수동 입찰 관리",
      "이메일 알림",
      "월간 리포트 1건",
    ],
    cta: "시작하기",
  },
  {
    key: "growth",
    name: "그로스",
    price: "₩249,000",
    priceNum: 249000,
    period: "/월",
    desc: "성장하는 대행사를 위한 인기 플랜",
    badge: "인기",
    highlight: true,
    accounts: "광고 계정 10개",
    features: [
      "네이버 광고 계정 연동 (10개)",
      "AI 자동 입찰 최적화",
      "AI 코파일럿",
      "경쟁사 분석",
      "부정클릭 방지",
      "ROI 시뮬레이터",
      "주간/월간 자동 리포트",
      "Slack/카카오 알림",
    ],
    cta: "가장 인기있는 플랜",
  },
  {
    key: "scale",
    name: "스케일",
    price: "₩490,000",
    priceNum: 490000,
    period: "/월",
    desc: "대규모 운영을 위한 프리미엄 플랜",
    accounts: "광고 계정 30개",
    features: [
      "네이버 광고 계정 연동 (30개)",
      "그로스 플랜의 모든 기능",
      "멀티 조직 관리",
      "고급 수익성 분석 (마진)",
      "감사 로그",
      "API 접근",
      "전담 매니저",
      "커스텀 리포트 템플릿",
    ],
    cta: "업그레이드",
  },
  {
    key: "enterprise",
    name: "엔터프라이즈",
    price: "문의",
    priceNum: 0,
    period: "",
    desc: "맞춤형 엔터프라이즈 솔루션",
    accounts: "무제한",
    features: [
      "무제한 광고 계정",
      "스케일 플랜의 모든 기능",
      "온프레미스 배포 옵션",
      "SSO / SAML 인증",
      "SLA 보장 (99.9%)",
      "맞춤 개발 지원",
      "전용 인프라",
      "24/7 프리미엄 지원",
    ],
    cta: "영업팀 연락",
  },
];

const faqs = [
  { q: "무료 체험이 가능한가요?", a: "네, 모든 플랜에서 14일 무료 체험이 가능합니다. 신용카드 없이 시작하세요." },
  { q: "결제 방법은 어떻게 되나요?", a: "카드 결제(Stripe), 계좌이체, 세금계산서 발행이 가능합니다." },
  { q: "플랜 변경이 자유로운가요?", a: "네, 언제든지 업그레이드/다운그레이드가 가능합니다. 차액은 일할 계산됩니다." },
  { q: "계약 기간이 있나요?", a: "월간 결제로 언제든 해지 가능합니다. 연간 결제 시 20% 할인을 제공합니다." },
];

export default function PricingPage() {
  const [annual, setAnnual] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "60px 24px" }}>
      {/* Hero */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <h1 style={{ fontSize: "2.5rem", fontWeight: 800, marginBottom: 16, lineHeight: 1.3 }}>
          에이전시에 맞는
          <br />
          <span style={{ background: "linear-gradient(135deg, var(--primary), #7C3AED)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>최적의 플랜</span>을 선택하세요
        </h1>
        <p style={{ fontSize: "1.143rem", color: "var(--text-secondary)", maxWidth: 600, margin: "0 auto 32px" }}>
          14일 무료 체험으로 시작하세요. 신용카드가 필요하지 않습니다.
        </p>

        {/* Billing Toggle */}
        <div style={{ display: "inline-flex", alignItems: "center", gap: 12, padding: "4px 6px", background: "var(--surface-hover)", borderRadius: "var(--radius-xl)" }}>
          <button
            onClick={() => setAnnual(false)}
            style={{
              padding: "8px 20px", borderRadius: "var(--radius-lg)", border: "none", cursor: "pointer",
              background: !annual ? "var(--primary)" : "transparent", color: !annual ? "#fff" : "var(--text-secondary)",
              fontWeight: 600, fontSize: "0.929rem", transition: "all 0.3s",
            }}
          >
            월간 결제
          </button>
          <button
            onClick={() => setAnnual(true)}
            style={{
              padding: "8px 20px", borderRadius: "var(--radius-lg)", border: "none", cursor: "pointer",
              background: annual ? "var(--primary)" : "transparent", color: annual ? "#fff" : "var(--text-secondary)",
              fontWeight: 600, fontSize: "0.929rem", transition: "all 0.3s",
            }}
          >
            연간 결제 <span style={{ color: annual ? "#86EFAC" : "var(--success)", fontSize: "0.786rem", fontWeight: 700 }}>-20%</span>
          </button>
        </div>
      </div>

      {/* Plans Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24, marginBottom: 80 }}>
        {plans.map((plan) => {
          const displayPrice = plan.priceNum > 0
            ? `₩${Math.round(annual ? plan.priceNum * 0.8 : plan.priceNum).toLocaleString()}`
            : plan.price;
          return (
            <div
              key={plan.key}
              style={{
                borderRadius: "var(--radius-xl)", padding: 32, position: "relative",
                border: plan.highlight ? "2px solid var(--primary)" : "1px solid var(--border)",
                background: plan.highlight ? "linear-gradient(180deg, var(--primary-light), #fff)" : "var(--surface)",
                boxShadow: plan.highlight ? "0 8px 32px rgba(30,64,175,0.12)" : "var(--shadow)",
                transition: "transform 0.3s, box-shadow 0.3s",
              }}
            >
              {plan.badge && (
                <div style={{
                  position: "absolute", top: -12, left: "50%", transform: "translateX(-50%)",
                  background: "var(--primary)", color: "#fff", padding: "4px 16px", borderRadius: 20,
                  fontSize: "0.786rem", fontWeight: 700,
                }}>
                  ⭐ {plan.badge}
                </div>
              )}
              <h3 style={{ fontSize: "1.286rem", fontWeight: 700, marginBottom: 4 }}>{plan.name}</h3>
              <p style={{ fontSize: "0.857rem", color: "var(--text-muted)", marginBottom: 20 }}>{plan.desc}</p>
              <div style={{ marginBottom: 20 }}>
                <span style={{ fontSize: "2rem", fontWeight: 800 }}>{displayPrice}</span>
                {plan.period && <span style={{ fontSize: "0.857rem", color: "var(--text-muted)" }}>{plan.period}</span>}
              </div>
              <div style={{ fontSize: "0.857rem", fontWeight: 600, color: "var(--primary)", marginBottom: 20, display: "flex", alignItems: "center", gap: 6 }}>
                <Users size={14} /> {plan.accounts}
              </div>
              <Link
                href="/login"
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%",
                  padding: "12px 0", borderRadius: "var(--radius-lg)", border: "none", cursor: "pointer",
                  background: plan.highlight ? "var(--primary)" : "var(--surface-hover)",
                  color: plan.highlight ? "#fff" : "var(--text-primary)",
                  fontWeight: 700, fontSize: "0.929rem", textDecoration: "none",
                  transition: "all 0.3s",
                }}
              >
                {plan.cta} <ArrowRight size={16} />
              </Link>
              <hr style={{ border: "none", borderTop: "1px solid var(--border)", margin: "24px 0" }} />
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
                {plan.features.map((f) => (
                  <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: "0.857rem", color: "var(--text-secondary)" }}>
                    <Check size={16} style={{ color: "var(--success)", flexShrink: 0, marginTop: 1 }} />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Feature Comparison Highlights */}
      <div style={{ textAlign: "center", marginBottom: 56 }}>
        <h2 style={{ fontSize: "1.714rem", fontWeight: 700, marginBottom: 32 }}>주요 기능 비교</h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 24 }}>
          {[
            { icon: Zap, title: "AI 자동 입찰", desc: "입찰가를 자동으로 최적화" },
            { icon: Bot, title: "AI 코파일럿", desc: "자연어로 광고 성과 분석" },
            { icon: Shield, title: "부정클릭 방지", desc: "의심 클릭 탐지 및 IP 차단" },
            { icon: BarChart3, title: "경쟁사 분석", desc: "경쟁사 입찰 동향 모니터링" },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <div key={item.title} style={{ padding: 24, borderRadius: "var(--radius-xl)", background: "var(--surface)", border: "1px solid var(--border)" }}>
                <div style={{ width: 48, height: 48, borderRadius: "var(--radius-lg)", background: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
                  <Icon size={24} />
                </div>
                <h4 style={{ fontWeight: 700, marginBottom: 4 }}>{item.title}</h4>
                <p style={{ fontSize: "0.857rem", color: "var(--text-muted)" }}>{item.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* FAQ */}
      <div style={{ maxWidth: 700, margin: "0 auto" }}>
        <h2 style={{ fontSize: "1.714rem", fontWeight: 700, textAlign: "center", marginBottom: 32 }}>자주 묻는 질문</h2>
        {faqs.map((faq, i) => (
          <div
            key={i}
            style={{
              borderBottom: "1px solid var(--border)", padding: "20px 0", cursor: "pointer",
            }}
            onClick={() => setOpenFaq(openFaq === i ? null : i)}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <strong style={{ fontSize: "1rem" }}>{faq.q}</strong>
              <span style={{ fontSize: "1.5rem", color: "var(--text-muted)", transform: openFaq === i ? "rotate(45deg)" : "none", transition: "transform 0.3s" }}>+</span>
            </div>
            {openFaq === i && (
              <p style={{ marginTop: 12, fontSize: "0.929rem", color: "var(--text-secondary)", lineHeight: 1.7 }}>{faq.a}</p>
            )}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{ textAlign: "center", marginTop: 80, padding: "48px 32px", borderRadius: "var(--radius-xl)", background: "linear-gradient(135deg, var(--primary), #7C3AED)", color: "#fff" }}>
        <Sparkles size={32} style={{ marginBottom: 16, opacity: 0.8 }} />
        <h2 style={{ fontSize: "1.714rem", fontWeight: 700, marginBottom: 8 }}>지금 바로 시작하세요</h2>
        <p style={{ opacity: 0.85, marginBottom: 24, fontSize: "1rem" }}>14일 무료 체험 · 신용카드 불필요 · 언제든 해지</p>
        <Link
          href="/login"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "14px 32px", borderRadius: "var(--radius-lg)",
            background: "#fff", color: "var(--primary)", fontWeight: 700,
            textDecoration: "none", fontSize: "1rem",
          }}
        >
          무료 체험 시작 <ArrowRight size={18} />
        </Link>
      </div>
    </div>
  );
}