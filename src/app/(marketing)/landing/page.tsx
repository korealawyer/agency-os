"use client";

import { useState } from "react";
import Link from "next/link";
import {
  BarChart3, FileText, Zap, Shield, Users, Clock,
  TrendingUp, CheckCircle, ArrowRight, Star, ChevronRight,
  Monitor, Sparkles, MousePointerClick,
} from "lucide-react";

const painPoints = [
  {
    icon: Monitor,
    emoji: "😤",
    title: "매일 30번 로그인해서\n계정 확인하시나요?",
    desc: "하루 45분을 네이버 광고 관리자 로그인에 낭비하고 있습니다.",
  },
  {
    icon: FileText,
    emoji: "📊",
    title: "매주 엑셀로\n리포트 만드시나요?",
    desc: "계정당 120분. 30개 계정이면 일주일이 리포트 작업으로 사라집니다.",
  },
  {
    icon: TrendingUp,
    emoji: "💸",
    title: "고객별 수익성\n파악이 안 되시나요?",
    desc: "적자 고객을 모른 채 서비스하고 있을 수 있습니다.",
  },
];

const features = [
  {
    icon: BarChart3,
    title: "📊 통합 대시보드",
    subtitle: "30개 계정을 한눈에, 3초 만에",
    desc: "모든 계정의 ROAS, CTR, 전환 데이터를 한 화면에서 실시간으로 모니터링합니다. 🟢🟡🔴 신호등 시스템으로 위기 계정을 즉시 파악합니다.",
    metrics: ["KPI 카드 5종", "계정별 상태 그리드", "시간대별 성과 차트"],
  },
  {
    icon: FileText,
    title: "📋 AI 리포트 자동화",
    subtitle: "120분 → 5분, 96% 시간 절감",
    desc: "템플릿 선택 한 번으로 전문적인 리포트가 자동 생성됩니다. 스케줄 설정으로 매주 월요일 자동 발송까지.",
    metrics: ["커스텀 템플릿", "자동 발송 스케줄", "열람 추적"],
  },
  {
    icon: Zap,
    title: "🤖 AI 자동 입찰",
    subtitle: "6가지 전략, 안전장치 내장",
    desc: "목표 순위, 목표 CPC, 목표 ROAS 등 6가지 AI 전략으로 24시간 자동 최적화합니다. 일예산 상한, 입찰가 제한 등 안전장치가 내장되어 있습니다.",
    metrics: ["6가지 입찰 전략", "컨펌 모드", "실시간 순위 모니터링"],
  },
];

const comparison = [
  { task: "성과 확인 (30개 계정)", before: "45분", after: "3분", saving: "93%" },
  { task: "입찰가 조정", before: "60분", after: "5분", saving: "92%" },
  { task: "리포트 작성", before: "120분", after: "5분", saving: "96%" },
  { task: "경쟁사 분석", before: "30분", after: "0분", saving: "100%" },
  { task: "영업 제안서", before: "60분", after: "15분", saving: "75%" },
];

const advisors = [
  { name: "김민수", role: "리드마케팅 대표", quote: "30개 계정을 혼자 관리할 수 있게 됐습니다. 리포트 자동화만으로 주 10시간 절약, ROAS 40% 개선.", rating: 5, company: "리드마케팅", metric: "ROAS 40%↑" },
  { name: "이정현", role: "퍼스트애드 퍼포먼스팀장", quote: "AI 자동 입찰이 수동 대비 월등히 빠르고 정확합니다. 팀 전체 ROAS가 평균 30% 향상됐어요.", rating: 5, company: "퍼스트애드", metric: "ROAS 30%↑" },
  { name: "박서연", role: "브릿지미디어 운영실장", quote: "엑셀 리포트 지옥에서 해방됐습니다. 고객사에 더 전략적인 제안에 집중할 수 있어요.", rating: 5, company: "브릿지미디어", metric: "리포트 96%↓" },
];

const trustLogos = [
  "리드마케팅", "퍼스트애드", "브릿지미디어", "애드인사이트", "마케팅플러스",
];

export default function LandingPage() {
  const [budget, setBudget] = useState(100000000);

  const savedHours = Math.min(Math.round((budget / 10000000) * 6.5 * 10) / 10, 4.0);
  const savedCost = Math.round(savedHours * 20 * 25000);

  return (
    <>
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <div className="hero-badge">
            <Sparkles size={14} />
            네이버 검색광고 AI 관리 플랫폼
          </div>
          <h1 className="hero-title">
            30개 계정을 한 화면에서.<br />
            리포트는 AI가 자동으로.
          </h1>
          <p className="hero-subtitle">
            이제 진짜 중요한 일에 집중하세요.<br />
            네이버 검색광고 멀티 계정 통합 관리의 새로운 기준.
          </p>
          <div className="hero-actions">
            <Link href="/login?view=signup" className="btn btn-primary btn-lg hero-cta-primary">
              14일 무료 체험 <ArrowRight size={18} />
            </Link>
            <Link href="/demo" className="btn btn-secondary btn-lg">
              데모 보기
            </Link>
          </div>
          <p className="hero-note">
            <CheckCircle size={14} /> 카드 등록 불필요 &nbsp;
            <CheckCircle size={14} /> 설정 5분 &nbsp;
            <CheckCircle size={14} /> 즉시 데이터 연동
          </p>
        </div>

        <div className="hero-dashboard-preview">
          <div className="hero-preview-card">
            <div className="hero-preview-header">
              <div style={{ display: "flex", gap: 6 }}>
                <span className="preview-dot red" />
                <span className="preview-dot yellow" />
                <span className="preview-dot green" />
              </div>
              <span style={{ fontSize: "0.714rem", color: "var(--text-muted)" }}>Agency OS Dashboard</span>
            </div>
            <div className="hero-preview-body">
              <div className="preview-kpi-row">
                {["₩45.2M", "320%", "2,847", "48,200", "156건"].map((v, i) => (
                  <div key={i} className="preview-kpi">
                    <div className="preview-kpi-val">{v}</div>
                    <div className="preview-kpi-label">{["광고비", "ROAS", "키워드", "클릭", "AI 액션"][i]}</div>
                  </div>
                ))}
              </div>
              <div className="preview-chart-placeholder">
                <div className="preview-chart-bar" style={{ height: "40%" }} />
                <div className="preview-chart-bar" style={{ height: "55%" }} />
                <div className="preview-chart-bar" style={{ height: "45%" }} />
                <div className="preview-chart-bar" style={{ height: "70%" }} />
                <div className="preview-chart-bar" style={{ height: "60%" }} />
                <div className="preview-chart-bar" style={{ height: "80%" }} />
                <div className="preview-chart-bar" style={{ height: "65%" }} />
              </div>
              <div className="preview-ai-row">
                <Sparkles size={14} color="var(--primary)" />
                <span>AI 추천: &ldquo;A 법률사무소 입찰가 15% 상향 제안&rdquo;</span>
                <button className="btn btn-primary btn-sm" style={{ marginLeft: "auto", pointerEvents: "none" }}>승인</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust Logo Banner */}
      <section style={{ background: "var(--surface)", borderBottom: "1px solid var(--border)", padding: "24px 0" }}>
        <div className="marketing-container">
          <p style={{ textAlign: "center", color: "var(--text-muted)", fontSize: "0.857rem", marginBottom: 16, fontWeight: 500 }}>이미 다수의 대행사가 Agency OS를 사용하고 있습니다</p>
          <div className="trust-logo-banner">
            {trustLogos.map((name) => (
              <div key={name} className="trust-logo-item">
                <Sparkles size={14} color="var(--primary)" />
                {name}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pain Points */}
      <section className="marketing-section" style={{ background: "var(--surface)" }}>
        <div className="marketing-container">
          <div className="section-header">
            <h2 className="section-title">😤 이런 경험 있으시죠?</h2>
            <p className="section-subtitle">대행사 마케터라면 매일 겪는 비효율, Agency OS가 해결합니다</p>
          </div>
          <div className="pain-grid">
            {painPoints.map((p, i) => (
              <div className="pain-card" key={i}>
                <div className="pain-emoji">{p.emoji}</div>
                <h3 className="pain-title">{p.title}</h3>
                <p className="pain-desc">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="marketing-section">
        <div className="marketing-container">
          <div className="section-header">
            <h2 className="section-title">🚀 Agency OS가 해결합니다</h2>
            <p className="section-subtitle">검색광고 대행사에 특화된 AI 기반 통합 관리 플랫폼</p>
          </div>
          <div className="features-list">
            {features.map((f, i) => {
              const Icon = f.icon;
              return (
                <div className="feature-row" key={i} style={{ flexDirection: i % 2 === 1 ? "row-reverse" : "row" }}>
                  <div className="feature-text">
                    <h3>{f.title}</h3>
                    <p className="feature-subtitle-text">{f.subtitle}</p>
                    <p className="feature-desc">{f.desc}</p>
                    <div className="feature-metrics">
                      {f.metrics.map((m, j) => (
                        <span key={j} className="feature-metric-tag">
                          <CheckCircle size={14} /> {m}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="feature-visual">
                    <div className="feature-visual-inner">
                      <Icon size={48} strokeWidth={1.5} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Interactive ROI Mini Simulator */}
      <section className="marketing-section" style={{ background: "linear-gradient(135deg, #1E40AF 0%, #7C3AED 100%)", color: "white" }}>
        <div className="marketing-container">
          <div className="section-header" style={{ color: "white" }}>
            <h2 className="section-title" style={{ color: "white" }}>🔮 우리 대행사에 적용하면?</h2>
            <p className="section-subtitle" style={{ color: "rgba(255,255,255,0.8)" }}>슬라이더를 움직여 예상 효과를 확인해보세요</p>
          </div>
          <div className="roi-mini-sim">
            <div className="roi-mini-input">
              <label style={{ display: "block", marginBottom: 8, fontWeight: 600 }}>
                월 관리 광고비
              </label>
              <input
                type="range"
                min={10000000}
                max={1000000000}
                step={10000000}
                value={budget}
                onChange={(e) => setBudget(Number(e.target.value))}
                className="roi-slider"
              />
              <div className="roi-slider-labels">
                <span>1천만</span>
                <span style={{ fontWeight: 700, fontSize: "1.286rem" }}>
                  {budget >= 100000000
                    ? `${(budget / 100000000).toFixed(1)}억원`
                    : `${(budget / 10000).toLocaleString()}만원`}
                </span>
                <span>10억</span>
              </div>
            </div>
            <div className="roi-mini-results">
              <div className="roi-result-card">
                <Clock size={24} />
                <div className="roi-result-value">하루 {savedHours}시간</div>
                <div className="roi-result-label">절감 시간</div>
              </div>
              <div className="roi-result-card">
                <TrendingUp size={24} />
                <div className="roi-result-value">월 {(savedCost / 10000).toLocaleString()}만원</div>
                <div className="roi-result-label">인건비 절감</div>
              </div>
              <div className="roi-result-card">
                <Sparkles size={24} />
                <div className="roi-result-value">{Math.round((savedCost / (budget >= 100000000 ? 600000 : 300000)) * 100)}%</div>
                <div className="roi-result-label">예상 ROI</div>
              </div>
            </div>
          </div>
          <div style={{ textAlign: "center", marginTop: 32 }}>
            <Link href="/roi-calculator" className="btn btn-lg" style={{ background: "white", color: "var(--primary)", fontWeight: 700 }}>
              상세 ROI 분석 보기 <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Before vs After */}
      <section className="marketing-section" style={{ background: "var(--surface)" }}>
        <div className="marketing-container">
          <div className="section-header">
            <h2 className="section-title">⏰ Before vs After</h2>
            <p className="section-subtitle">하루 8시간 → 1.5시간 (81% 절감)</p>
          </div>
          <div className="comparison-table-wrapper">
            <table className="comparison-table">
              <thead>
                <tr>
                  <th>업무</th>
                  <th>Before (수동)</th>
                  <th>After (Agency OS)</th>
                  <th>절감율</th>
                </tr>
              </thead>
              <tbody>
                {comparison.map((c, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600 }}>{c.task}</td>
                    <td style={{ color: "var(--error)" }}>{c.before}</td>
                    <td style={{ color: "var(--success)", fontWeight: 700 }}>{c.after}</td>
                    <td>
                      <span className="badge badge-success">{c.saving}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="marketing-section">
        <div className="marketing-container">
          <div className="section-header">
            <h2 className="section-title">💬 어드바이저들의 한마디</h2>
            <p className="section-subtitle">현직 대행사 전문가가 직접 검증했습니다</p>
          </div>
          <div className="testimonial-grid">
            {advisors.map((a, i) => (
              <div className="testimonial-card" key={i}>
                <div className="testimonial-stars">
                  {Array.from({ length: a.rating }).map((_, j) => (
                    <Star key={j} size={16} fill="#F59E0B" color="#F59E0B" />
                  ))}
                </div>
                <p className="testimonial-quote">&ldquo;{a.quote}&rdquo;</p>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <span className="badge badge-success">{a.metric}</span>
                </div>
                <div className="testimonial-author">
                  <div className="testimonial-avatar">{a.name[0]}</div>
                  <div>
                    <div className="testimonial-name">{a.name}</div>
                    <div className="testimonial-role">{a.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Competitor Switch Banner */}
      <section className="marketing-section" style={{ background: "var(--surface)" }}>
        <div className="marketing-container">
          <div className="switch-banner">
            <div className="switch-banner-content">
              <h3>🔄 보라웨어 / 비딩윈에서 3분 만에 전환하세요</h3>
              <p>기존 설정을 CSV로 임포트하면 끝. 전환 고객 한정 첫 3개월 50% 할인!</p>
            </div>
            <Link href="/login?view=signup" className="btn btn-primary btn-lg hero-cta-primary">
              전환 혜택 받기 <ChevronRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="cta-section">
        <div className="marketing-container" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "2.286rem", fontWeight: 700, marginBottom: 16 }}>
            🎯 지금 시작하세요
          </h2>
          <p style={{ fontSize: "1.143rem", color: "var(--text-secondary)", marginBottom: 32, maxWidth: 500, margin: "0 auto 32px" }}>
            14일 무료, 카드 등록 불필요.<br />
            30개 계정을 한 화면에서 관리하는 경험을 직접 해보세요.
          </p>
          <Link href="/login?view=signup" className="btn btn-primary btn-lg hero-cta-primary" style={{ fontSize: "1.143rem", padding: "16px 48px" }}>
            14일 무료 체험 시작하기 <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
