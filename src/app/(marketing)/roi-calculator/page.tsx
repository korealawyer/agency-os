"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import {
  Clock, TrendingUp, Sparkles, ArrowRight, CheckCircle,
  BarChart3, Target,
} from "lucide-react";

const industries = ["법률", "의료/성형", "교육", "부동산", "식음료", "인테리어", "쇼핑몰", "기타"];

const taskSavings = [
  { task: "성과 확인 (대시보드)", before: 45, after: 3 },
  { task: "입찰가 조정", before: 60, after: 5 },
  { task: "리포트 작성/발송", before: 120, after: 5 },
  { task: "경쟁사 모니터링", before: 30, after: 0 },
  { task: "영업 제안서 작성", before: 60, after: 15 },
];

function getRecommendedPlan(adBudget: number) {
  if (adBudget <= 5000000) return { name: "Personal", price: 0 };
  if (adBudget <= 30000000) return { name: "Starter", price: 300000 };
  if (adBudget <= 100000000) return { name: "Growth", price: 600000 };
  if (adBudget <= 300000000) return { name: "Scale", price: 1000000 };
  return { name: "Enterprise", price: 1500000 };
}

export default function ROICalculatorPage() {
  const [adBudget, setAdBudget] = useState(100000000);
  const [accountCount, setAccountCount] = useState(15);
  const [industry, setIndustry] = useState("법률");
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const results = useMemo(() => {
    const multiplier = accountCount / 10;
    const totalBefore = taskSavings.reduce((acc, t) => acc + t.before, 0);
    const totalAfter = taskSavings.reduce((acc, t) => acc + t.after, 0);
    const savedMinutes = (totalBefore - totalAfter) * multiplier;
    const rawHoursDay = savedMinutes / 60;
    // Cap at 4 hours/day per person for realistic numbers (CRO audit fix)
    const savedHoursDay = Math.round(Math.min(rawHoursDay, 4.0) * 10) / 10;
    const savedHoursMonth = Math.round(savedHoursDay * 20);
    const hourlyCost = 25000;
    const monthlySaving = savedHoursMonth * hourlyCost;
    const plan = getRecommendedPlan(adBudget);
    const roi = plan.price > 0 ? Math.round((monthlySaving / plan.price) * 100) : 0;

    return {
      savedHoursDay,
      savedHoursMonth,
      monthlySaving,
      plan,
      roi,
      multiplier,
    };
  }, [adBudget, accountCount]);

  return (
    <>
      {/* Header */}
      <section className="marketing-section" style={{ paddingTop: 120, paddingBottom: 0 }}>
        <div className="marketing-container" style={{ textAlign: "center" }}>
          <div className="hero-badge" style={{ margin: "0 auto 16px" }}>
            <Sparkles size={14} />
            로그인 없이 바로 체험
          </div>
          <h1 style={{ fontSize: "2.571rem", fontWeight: 700, marginBottom: 12 }}>
            🔮 우리 대행사에 Agency OS를 적용하면?
          </h1>
          <p style={{ color: "var(--text-secondary)", fontSize: "1.143rem" }}>
            간단한 정보만 입력하면 예상 효과를 바로 확인할 수 있습니다
          </p>
        </div>
      </section>

      {/* Calculator */}
      <section className="marketing-section">
        <div className="marketing-container">
          <div className="roi-calc-layout">
            {/* Input Panel */}
            <div className="roi-calc-input card">
              <div className="card-header">
                <h3><Target size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />간단히 입력하세요</h3>
              </div>
              <div className="card-body">
                <div className="form-group">
                  <label className="form-label">월 관리 광고비</label>
                  <input
                    type="range"
                    min={10000000}
                    max={1000000000}
                    step={10000000}
                    value={adBudget}
                    onChange={(e) => setAdBudget(Number(e.target.value))}
                    className="roi-slider"
                  />
                  <div className="roi-slider-labels" style={{ color: "var(--text-secondary)" }}>
                    <span>1천만</span>
                    <span style={{ fontWeight: 700, fontSize: "1.286rem", color: "var(--primary)" }}>
                      {adBudget >= 100000000
                        ? `${(adBudget / 100000000).toFixed(1)}억원`
                        : `${(adBudget / 10000).toLocaleString()}만원`}
                    </span>
                    <span>10억</span>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">관리 계정 수</label>
                  <input
                    type="number"
                    className="form-input"
                    value={accountCount}
                    onChange={(e) => setAccountCount(Math.max(1, Math.min(100, Number(e.target.value))))}
                    min={1}
                    max={100}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">주 업종</label>
                  <select
                    className="form-input"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                  >
                    {industries.map((ind) => (
                      <option key={ind} value={ind}>{ind}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Results Panel */}
            <div className="roi-calc-results">
              <div className="roi-results-grid">
                <div className="roi-result-box">
                  <Clock size={28} color="var(--primary)" />
                  <div className="roi-result-big">{results.savedHoursDay}시간</div>
                  <div className="roi-result-sub">하루 절감 시간</div>
                  <div className="roi-result-detail">월 {results.savedHoursMonth}시간</div>
                </div>
                <div className="roi-result-box">
                  <TrendingUp size={28} color="var(--success)" />
                  <div className="roi-result-big">₩{(results.monthlySaving / 10000).toLocaleString()}만</div>
                  <div className="roi-result-sub">월 인건비 절감</div>
                  <div className="roi-result-detail">시급 ₩25,000 기준</div>
                </div>
                <div className="roi-result-box highlight">
                  <Sparkles size={28} color="var(--primary)" />
                  <div className="roi-result-big">{results.plan.name}</div>
                  <div className="roi-result-sub">추천 플랜</div>
                  <div className="roi-result-detail">
                    {results.plan.price > 0
                      ? `월 ₩${(results.plan.price / 10000).toLocaleString()}만 · ROI ${results.roi}%`
                      : "무료"}
                  </div>
                </div>
              </div>

              {/* Task Breakdown */}
              <div className="card" style={{ marginTop: 24 }}>
                <div className="card-header">
                  <h3><BarChart3 size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />업무별 절감 상세</h3>
                </div>
                <div className="table-wrapper">
                  <table>
                    <thead>
                      <tr>
                        <th>업무</th>
                        <th>현재 (분)</th>
                        <th>적용 후 (분)</th>
                        <th>절감율</th>
                      </tr>
                    </thead>
                    <tbody>
                      {taskSavings.map((t, i) => {
                        const saving = Math.round(((t.before - t.after) / t.before) * 100);
                        return (
                          <tr key={i}>
                            <td style={{ fontWeight: 600 }}>{t.task}</td>
                            <td style={{ color: "var(--error)" }}>{Math.round(t.before * results.multiplier)}분</td>
                            <td style={{ color: "var(--success)", fontWeight: 700 }}>{Math.round(t.after * results.multiplier)}분</td>
                            <td><span className="badge badge-success">{saving}%</span></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Lead Capture */}
      <section className="marketing-section" style={{ background: "var(--surface)" }}>
        <div className="marketing-container" style={{ maxWidth: 600, textAlign: "center" }}>
          <h2 style={{ marginBottom: 8 }}>📧 상세 분석 리포트를 이메일로 받아보세요</h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 24 }}>
            업종별 벤치마크 데이터와 맞춤 ROI 분석을 포함한 PDF 리포트를 무료로 보내드립니다
          </p>
          {!submitted ? (
            <div style={{ display: "flex", gap: 12, maxWidth: 480, margin: "0 auto" }}>
              <input
                type="email"
                className="form-input"
                placeholder="이메일 주소를 입력하세요"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <button
                className="btn btn-primary"
                onClick={() => { if (email) setSubmitted(true); }}
                style={{ whiteSpace: "nowrap" }}
              >
                무료 리포트 받기
              </button>
            </div>
          ) : (
            <div className="card" style={{ padding: 24, textAlign: "center" }}>
              <CheckCircle size={32} color="var(--success)" />
              <p style={{ fontWeight: 600, marginTop: 12 }}>
                {email}으로 리포트를 발송했습니다!
              </p>
              <p style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>
                (데모 환경입니다. 실제 발송은 서비스 런칭 후 제공됩니다.)
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Final CTA */}
      <section className="cta-section">
        <div className="marketing-container" style={{ textAlign: "center" }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, marginBottom: 12 }}>
            🎯 지금 시작하세요
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: 32 }}>
            카드 등록 불필요 · 설정 5분 · 즉시 데이터 연동
          </p>
          <Link href="/login" className="btn btn-primary btn-lg" style={{ fontSize: "1.143rem", padding: "16px 48px" }}>
            14일 무료 체험 시작하기 <ArrowRight size={18} />
          </Link>
        </div>
      </section>
    </>
  );
}
