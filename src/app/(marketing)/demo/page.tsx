"use client";

import Link from "next/link";
import {
  Play, BarChart3, Zap, FileText, Shield, ArrowRight,
  CheckCircle, Star, Monitor, Sparkles,
} from "lucide-react";

const tourSteps = [
  {
    icon: BarChart3,
    title: "📊 통합 대시보드",
    subtitle: "30개 계정을 한눈에",
    desc: "모든 광고 계정의 핵심 KPI를 하나의 대시보드에서 실시간으로 확인합니다. 🟢🟡🔴 신호등 시스템으로 위기 계정을 즉시 감지하고, AI 추천 액션을 원클릭으로 승인합니다.",
    features: ["5종 KPI 카드 — 광고비, ROAS, 키워드, 클릭, AI 액션", "계정별 상태 그리드 — 정상/주의/긴급 한눈에", "일별 ROAS 차트 + AI 추천 패널"],
  },
  {
    icon: Zap,
    title: "🔑 AI 자동 입찰",
    subtitle: "6가지 전략, 원클릭 승인",
    desc: "목표 순위, 목표 CPC, 목표 ROAS, 최대 전환, 시간대 차등, 수동 — 6가지 AI 입찰 전략 중 선택하세요. AI가 24시간 실시간으로 입찰가를 최적화합니다.",
    features: ["스프레드시트형 키워드 관리 — 벌크 수정 지원", "실시간 순위 모니터링 + 품질지수 표시", "안전장치 내장 — 일예산 상한, 입찰가 제한"],
  },
  {
    icon: FileText,
    title: "📋 리포트 자동화",
    subtitle: "120분 → 5분, 96% 절감",
    desc: "전문적인 고객 리포트를 템플릿 한 번 선택으로 자동 생성합니다. 매주/매월 자동 발송 스케줄을 설정하면 완전 자동화됩니다.",
    features: ["커스텀 템플릿 — 로고, KPI 항목 선택", "자동 발송 스케줄 — 매주 월요일 09:00", "열람 추적 — PDF 다운로드/이메일 오픈 확인"],
  },
  {
    icon: Shield,
    title: "🤖 자동화 설정",
    subtitle: "안전장치 내장 AI",
    desc: "Semi Auto, Full Auto, Manual 세 가지 컨펌 모드로 AI 제어 수준을 조절합니다. 모든 자동화에는 안전장치가 내장되어 있어 예산 초과나 비정상 입찰을 방지합니다.",
    features: ["컨펌 모드 3단계 — 사용자의 신뢰도에 맞게", "안전장치 4종 — 예산/입찰가/속도 제한", "자동화 실행 로그 — 모든 변경 추적"],
  },
];

const caseStudies = [
  {
    company: "A 마케팅 대행사",
    result: "리포트 작업 96% 감소",
    detail: "주 20시간 → 주 1시간. 절약된 시간으로 고객 전략 미팅에 집중",
    metric: "ROAS 30% ↑",
  },
  {
    company: "B 퍼포먼스 에이전시",
    result: "관리 계정 3배 확장",
    detail: "10개 → 30개 계정을 동일 인원으로 관리. 매출 2배 성장",
    metric: "매출 200% ↑",
  },
  {
    company: "C 종합 광고 대행사",
    result: "AI 입찰로 비용 절감",
    detail: "수동 입찰 대비 CPC 15% 하락, ROAS 25% 향상",
    metric: "CPC 15% ↓",
  },
];

export default function DemoPage() {
  return (
    <>
      {/* Hero */}
      <section className="marketing-section" style={{ paddingTop: 120 }}>
        <div className="marketing-container" style={{ textAlign: "center" }}>
          <h1 style={{ fontSize: "2.571rem", fontWeight: 700, marginBottom: 12 }}>
            Agency OS를 3분 만에 체험하세요
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.143rem", marginBottom: 40 }}>
            핵심 기능을 살펴보고 대행사 운영의 새로운 기준을 확인하세요
          </p>

          {/* Video Placeholder */}
          <div className="demo-video-container">
            <div className="demo-video-placeholder">
              <div className="demo-play-btn">
                <Play size={32} fill="white" color="white" />
              </div>
              <p style={{ color: "rgba(255,255,255,0.8)", marginTop: 16, fontSize: "0.929rem" }}>
                제품 투어 영상 (3분)
              </p>
              <div className="demo-video-overlay">
                <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                  <span className="preview-dot red" />
                  <span className="preview-dot yellow" />
                  <span className="preview-dot green" />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} />
                  <span style={{ fontWeight: 600, fontSize: "0.857rem" }}>Agency OS — Product Tour</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Tours */}
      <section className="marketing-section">
        <div className="marketing-container">
          <div className="section-header">
            <h2 className="section-title">🎯 핵심 기능 투어</h2>
            <p className="section-subtitle">4가지 핵심 기능으로 대행사 운영을 혁신합니다</p>
          </div>

          <div className="tour-list">
            {tourSteps.map((step, i) => {
              const Icon = step.icon;
              return (
                <div className="tour-step" key={i}>
                  <div className="tour-step-number">{i + 1}</div>
                  <div className="tour-step-content">
                    <div className="tour-step-text">
                      <h3>{step.title}</h3>
                      <p className="tour-step-subtitle">{step.subtitle}</p>
                      <p className="tour-step-desc">{step.desc}</p>
                      <ul className="tour-step-features">
                        {step.features.map((f, j) => (
                          <li key={j}>
                            <CheckCircle size={16} color="var(--success)" />
                            <span>{f}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="tour-step-visual">
                      <div className="tour-visual-inner">
                        <Icon size={48} strokeWidth={1.5} color="var(--primary)" />
                        <span style={{ display: "block", marginTop: 8, fontSize: "0.857rem", color: "var(--text-muted)" }}>
                          {step.subtitle}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Case Studies */}
      <section className="marketing-section" style={{ background: "var(--surface)" }}>
        <div className="marketing-container">
          <div className="section-header">
            <h2 className="section-title">📈 고객 사례</h2>
            <p className="section-subtitle">Agency OS를 도입한 대행사들의 실제 성과</p>
          </div>
          <div className="case-grid">
            {caseStudies.map((c, i) => (
              <div className="case-card" key={i}>
                <div className="case-metric-badge">
                  <Star size={14} fill="#F59E0B" color="#F59E0B" />
                  {c.metric}
                </div>
                <h3 className="case-company">{c.company}</h3>
                <p className="case-result">{c.result}</p>
                <p className="case-detail">{c.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="cta-section">
        <div className="marketing-container" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 12 }}>
            직접 체험해보세요
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32, maxWidth: 420, margin: "0 auto 32px" }}>
            14일 무료 체험으로 Agency OS가 어떻게 대행사 운영을 혁신하는지 확인하세요
          </p>
          <div style={{ display: "flex", gap: 16, justifyContent: "center", flexWrap: "wrap" }}>
            <Link href="/login" className="btn btn-primary btn-lg" style={{ fontSize: "1.143rem", padding: "16px 48px" }}>
              14일 무료 체험 시작 <ArrowRight size={18} />
            </Link>
            <a href="mailto:sales@agencyos.kr" className="btn btn-secondary btn-lg" style={{ fontSize: "1.143rem", padding: "16px 48px" }}>
              상담 예약
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
