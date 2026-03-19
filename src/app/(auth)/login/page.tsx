"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Sparkles, TrendingUp, BarChart3, FileText, ArrowRight, ArrowLeft, Check, Mail, KeyRound, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { signIn } from "next-auth/react";

type AuthView = "login" | "signup" | "onboarding" | "verify" | "reset";

function LoginPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useState<AuthView>("login");
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [resetStep, setResetStep] = useState(1);
  const [apiTestResult, setApiTestResult] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [termsModal, setTermsModal] = useState<"terms" | "privacy" | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Read URL params (view + NextAuth error from redirect)
  useEffect(() => {
    const viewParam = searchParams.get("view");
    if (viewParam === "signup") {
      setView("signup");
    }
    // Handle NextAuth error redirect (production Vercel may redirect with ?error=...)
    const errorParam = searchParams.get("error");
    if (errorParam) {
      if (errorParam === "CredentialsSignin" || errorParam === "CallbackRouteError") {
        setAuthError("이메일 또는 비밀번호가 올바르지 않습니다.");
      } else {
        setAuthError("로그인에 실패했습니다. 다시 시도해주세요.");
      }
      // Clean up URL
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      url.searchParams.delete("callbackUrl");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, [searchParams]);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form state
  const [signupName, setSignupName] = useState("");
  const [signupAgency, setSignupAgency] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupPasswordConfirm, setSignupPasswordConfirm] = useState("");

  const handleApiTest = () => {
    // TODO: 실제 네이버 API 연결 테스트 구현 필요
    setApiTestResult("testing");
    setTimeout(() => setApiTestResult("error"), 1500);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (isLocked) return;
    if (!loginEmail.trim() || !loginPassword.trim()) {
      setAuthError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        email: loginEmail,
        password: loginPassword,
        redirect: false,
        redirectTo: "/dashboard",
      });

      if (result?.error) {
        // NextAuth returned an error object
        const attempts = loginAttempts + 1;
        setLoginAttempts(attempts);
        setAuthError("이메일 또는 비밀번호가 올바르지 않습니다.");

        if (attempts >= 5) {
          setIsLocked(true);
          setTimeout(() => { setIsLocked(false); setLoginAttempts(0); }, 15000);
        }
      } else if (result?.ok) {
        router.push("/dashboard");
      } else {
        // Unexpected result
        const attempts = loginAttempts + 1;
        setLoginAttempts(attempts);
        setAuthError("이메일 또는 비밀번호가 올바르지 않습니다.");

        if (attempts >= 5) {
          setIsLocked(true);
          setTimeout(() => { setIsLocked(false); setLoginAttempts(0); }, 15000);
        }
      }
    } catch (err: any) {
      // NextAuth v5 may throw instead of returning error object
      const errMsg = err?.message || err?.toString() || "";
      if (errMsg.includes("CredentialsSignin") || errMsg.includes("CallbackRouteError") || errMsg.includes("credentials")) {
        const attempts = loginAttempts + 1;
        setLoginAttempts(attempts);
        setAuthError("이메일 또는 비밀번호가 올바르지 않습니다.");

        if (attempts >= 5) {
          setIsLocked(true);
          setTimeout(() => { setIsLocked(false); setLoginAttempts(0); }, 15000);
        }
      } else {
        setAuthError("로그인 중 오류가 발생했습니다. 다시 시도해주세요.");
      }
    }
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!signupName.trim() || !signupEmail.trim() || !signupPassword.trim()) {
      setAuthError("모든 필드를 입력해주세요.");
      return;
    }
    if (signupPassword !== signupPasswordConfirm) {
      setAuthError("비밀번호가 일치하지 않습니다.");
      return;
    }
    if (signupPassword.length < 8) {
      setAuthError("비밀번호는 8자 이상이어야 합니다.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: signupName,
          email: signupEmail,
          password: signupPassword,
          organizationName: signupAgency || signupName + '의 에이전시',
        }),
      });
      const data = await res.json();

      if (res.ok) {
        // 자동 로그인 후 대시보드로 이동
        const loginResult = await signIn('credentials', {
          email: signupEmail,
          password: signupPassword,
          redirect: false,
        });
        if (loginResult?.ok) {
          router.push('/dashboard');
        } else {
          // 회원가입 성공했지만 자동 로그인 실패 시 로그인 폼으로
          setView('login');
          setLoginEmail(signupEmail);
          setAuthError('회원가입이 완료되었습니다. 로그인해주세요.');
        }
      } else {
        setAuthError(data.error?.message || '회원가입에 실패했습니다.');
      }
    } catch {
      setAuthError('서버와의 연결에 실패했습니다. 다시 시도해주세요.');
    }
    setIsLoading(false);
  };

  return (
    <div className="login-page">
      {/* Left Hero Section */}
      <div className="login-hero">
        <div style={{ marginBottom: "48px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "48px" }}>
            <Sparkles size={32} />
            <span style={{ fontSize: "1.5rem", fontWeight: 700 }}>Agency OS</span>
          </div>
          <h1>AI가 당신의 광고를<br />관리합니다</h1>
          <p style={{ fontSize: "1.143rem", opacity: 0.8, marginTop: "16px" }}>
            네이버 검색광고 멀티 계정 통합 관리 플랫폼
          </p>
        </div>
        <div className="login-hero-feature"><TrendingUp size={20} /><span>✨ AI 자동 입찰로 ROAS 30% 향상</span></div>
        <div className="login-hero-feature"><BarChart3 size={20} /><span>📊 30개 계정을 하나의 대시보드에서</span></div>
        <div className="login-hero-feature"><FileText size={20} /><span>📋 원클릭 클라이언트 리포트 자동 생성</span></div>

      </div>

      {/* Right Form Section */}
      <div className="login-form-section">
        <div className="login-form-container">

          {/* Error Message */}
          {authError && (
            <div style={{ padding: "10px 14px", background: "#FEF2F2", borderRadius: "var(--radius-md)", fontSize: "0.857rem", color: "#DC2626", marginBottom: 16 }}>
              ⚠️ {authError}
            </div>
          )}

          {/* ─── LOGIN ─── */}
          {view === "login" && (
            <form onSubmit={handleLogin}>
              <h2>로그인</h2>
              <p className="subtitle">Agency OS에 오신 것을 환영합니다</p>
              <div className="form-group">
                <label className="form-label" htmlFor="email">이메일</label>
                <input id="email" type="email" className="form-input" placeholder="name@agency.com" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="password">비밀번호</label>
                <input id="password" type="password" className="form-input" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.857rem", color: "var(--text-secondary)" }}>
                  <input type="checkbox" /> 로그인 유지
                </label>
                <a href="#" style={{ fontSize: "0.857rem" }} onClick={(e) => { e.preventDefault(); setView("reset"); setResetStep(1); setAuthError(null); }}>비밀번호 찾기</a>
              </div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={isLocked || isLoading}>
                {isLoading ? <><Loader2 size={16} className="spin" /> 로그인 중...</> : isLocked ? "🔒 15초간 잠금" : "로그인"}
              </button>
              {loginAttempts >= 3 && !isLocked && (
                <div style={{ padding: "10px 14px", background: "#FEF2F2", borderRadius: "var(--radius-md)", fontSize: "0.857rem", color: "#DC2626", marginTop: 8 }}>
                  ⚠️ 로그인 {loginAttempts}/5회 실패. {5 - loginAttempts}회 더 실패 시 15초간 잠깁니다.
                </div>
              )}
              {isLocked && (
                <div style={{ padding: "10px 14px", background: "#FEF2F2", borderRadius: "var(--radius-md)", fontSize: "0.857rem", color: "#DC2626", marginTop: 8 }}>
                  🔒 보안을 위해 계정이 일시 잠겼습니다. 15초 후 다시 시도해주세요.
                </div>
              )}
              <div className="login-divider">또는</div>
              <button type="button" className="social-btn" disabled style={{ opacity: 0.5, cursor: 'not-allowed' }}>
                <svg width="18" height="18" viewBox="0 0 18 18"><path d="M16.51 8H8.98v3h4.3c-.18 1-.74 1.48-1.6 2.04v2.01h2.6a7.8 7.8 0 002.38-5.88c0-.57-.05-.66-.15-1.18z" fill="#4285F4"/><path d="M8.98 17c2.16 0 3.97-.72 5.3-1.94l-2.6-2a4.8 4.8 0 01-7.18-2.54H1.83v2.07A8 8 0 008.98 17z" fill="#34A853"/><path d="M4.5 10.52a4.8 4.8 0 010-3.04V5.41H1.83a8 8 0 000 7.18l2.67-2.07z" fill="#FBBC05"/><path d="M8.98 3.58c1.16 0 2.23.4 3.06 1.2l2.3-2.3A8 8 0 001.83 5.4L4.5 7.49a4.77 4.77 0 014.48-3.9z" fill="#EA4335"/></svg>
                Google 로그인 (준비 중)
              </button>
              <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.857rem", color: "var(--text-secondary)" }}>
                계정이 없으신가요? <a href="#" style={{ fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setView("signup"); setAuthError(null); }}>무료 체험 시작하기</a>
              </p>
              <p style={{ textAlign: "center", marginTop: "16px", fontSize: "0.714rem", color: "var(--text-muted)" }}>
                로그인함으로써 귀하는 Agency OS의 <a href="#" onClick={(e) => { e.preventDefault(); setTermsModal("terms"); }}>이용약관</a> 및 <a href="#" onClick={(e) => { e.preventDefault(); setTermsModal("privacy"); }}>개인정보처리방침</a>에 동의하게 됩니다.
              </p>
            </form>
          )}

          {/* ─── SIGNUP (1-B) ─── */}
          {view === "signup" && (
            <form onSubmit={handleSignup}>
              <h2>회원가입</h2>
              <p className="subtitle">14일 무료 체험을 시작하세요</p>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div className="form-group"><label className="form-label">이름</label><input className="form-input" placeholder="홍길동" value={signupName} onChange={(e) => setSignupName(e.target.value)} /></div>
                <div className="form-group"><label className="form-label">대행사명</label><input className="form-input" placeholder="안티그래비티 마케팅" value={signupAgency} onChange={(e) => setSignupAgency(e.target.value)} /></div>
              </div>
              <div className="form-group"><label className="form-label">이메일</label><input type="email" className="form-input" placeholder="name@agency.com" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">비밀번호</label><input type="password" className="form-input" placeholder="8자 이상" value={signupPassword} onChange={(e) => setSignupPassword(e.target.value)} /></div>
              <div className="form-group"><label className="form-label">비밀번호 확인</label><input type="password" className="form-input" placeholder="비밀번호 재입력" value={signupPasswordConfirm} onChange={(e) => setSignupPasswordConfirm(e.target.value)} /></div>
              <button type="submit" className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 8, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }} disabled={isLoading}>
                {isLoading ? <><Loader2 size={16} className="spin" /> 처리 중...</> : <>무료 체험 시작하기 <ArrowRight size={16} /></>}
              </button>
              <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.857rem", color: "var(--text-secondary)" }}>
                이미 계정이 있으신가요? <a href="#" style={{ fontWeight: 600 }} onClick={(e) => { e.preventDefault(); setView("login"); setAuthError(null); }}>로그인</a>
              </p>
            </form>
          )}

          {/* ─── EMAIL VERIFICATION (1-E) ─── */}
          {view === "verify" && (
            <div style={{ textAlign: "center", padding: "32px 0" }}>
              <Mail size={48} color="var(--primary)" style={{ marginBottom: 16 }} />
              <h2>✅ 회원가입 완료</h2>
              <p style={{ color: "var(--text-secondary)", margin: "12px 0 24px" }}>
                <strong>{signupEmail || "user@example.com"}</strong> 계정이 생성되었습니다.
              </p>
              <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 24 }} onClick={() => { setView("login"); setLoginEmail(signupEmail); setAuthError(null); }}>
                로그인하러 가기
              </button>
            </div>
          )}

          {/* ─── ONBOARDING WIZARD (1-C) ─── */}
          {view === "onboarding" && (
            <>
              <h2>환영합니다! 🎉</h2>
              <p className="subtitle">3단계로 시작할 수 있습니다</p>
              {/* Progress */}
              <div style={{ display: "flex", gap: 8, marginBottom: 24 }}>
                {[1, 2, 3].map((s) => (
                  <div key={s} style={{ flex: 1, height: 4, borderRadius: 2, background: s <= onboardingStep ? "var(--primary)" : "var(--border)", transition: "all 0.3s" }} />
                ))}
              </div>

              {onboardingStep === 1 && (
                <>
                  <h3 style={{ marginBottom: 16 }}>1️⃣ 대행사 정보 입력</h3>
                  <div className="form-group"><label className="form-label">대행사명</label><input className="form-input" defaultValue={signupAgency || "안티그래비티 마케팅"} /></div>
                  <div className="form-group"><label className="form-label">사업자번호</label><input className="form-input" placeholder="123-45-67890" /></div>
                  <div className="form-group"><label className="form-label">대표 이메일</label><input className="form-input" placeholder="contact@agency.com" /></div>
                </>
              )}
              {onboardingStep === 2 && (
                <>
                  <h3 style={{ marginBottom: 16 }}>2️⃣ 네이버 API 키 등록</h3>
                  <div className="form-group"><label className="form-label">API License Key</label><input className="form-input" placeholder="네이버 API 라이선스 키" /></div>
                  <div className="form-group"><label className="form-label">Secret Key</label><input type="password" className="form-input" placeholder="Secret Key" /></div>
                  <div className="form-group"><label className="form-label">Customer ID</label><input className="form-input" placeholder="네이버 광고 고객 ID" /></div>
                  <button
                    className={`btn ${apiTestResult === "success" ? "btn-success" : apiTestResult === "error" ? "btn-error" : "btn-secondary"}`}
                    style={{ width: "100%", marginTop: 8 }}
                    onClick={handleApiTest}
                    disabled={apiTestResult === "testing"}
                  >
                    <KeyRound size={16} />
                    {apiTestResult === "idle" && "연결 테스트"}
                    {apiTestResult === "testing" && "테스트 중..."}
                    {apiTestResult === "success" && "🟢 연결 성공!"}
                    {apiTestResult === "error" && "❌ 연결 실패"}
                  </button>
                </>
              )}
              {onboardingStep === 3 && (
                <>
                  <h3 style={{ marginBottom: 16 }}>3️⃣ 기존 도구에서 전환</h3>
                  <p style={{ color: "var(--text-secondary)", marginBottom: 16, fontSize: "0.857rem" }}>기존에 사용하던 도구가 있으시면 데이터를 가져올 수 있습니다.</p>
                  {["보라웨어", "비딩윈", "네이버스"].map((tool) => (
                    <div key={tool} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", padding: "14px 16px", marginBottom: 8, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontWeight: 600 }}>{tool}</span>
                      <button className="btn btn-sm btn-secondary">CSV 업로드</button>
                    </div>
                  ))}
                  <div style={{ border: "1px dashed var(--border)", borderRadius: "var(--radius-lg)", padding: "16px", marginTop: 16, textAlign: "center", color: "var(--text-muted)" }}>
                    건너뛰기도 가능합니다
                  </div>
                </>
              )}

              <div style={{ display: "flex", gap: 8, marginTop: 24 }}>
                {onboardingStep > 1 && (
                  <button className="btn btn-secondary" onClick={() => setOnboardingStep((s) => s - 1)}>
                    <ArrowLeft size={16} /> 이전
                  </button>
                )}
                {onboardingStep < 3 ? (
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setOnboardingStep((s) => s + 1)}>
                    다음 <ArrowRight size={16} />
                  </button>
                ) : (
                  <button className="btn btn-primary" style={{ flex: 1, width: "100%" }} onClick={() => router.push("/dashboard")}>
                    <Check size={16} /> 완료 — 대시보드로 이동
                  </button>
                )}
              </div>
            </>
          )}

          {/* ─── PASSWORD RESET (1-F) ─── */}
          {view === "reset" && (
            <>
              {resetStep === 1 ? (
                <>
                  <h2>비밀번호 재설정</h2>
                  <p className="subtitle">가입한 이메일 주소를 입력하세요</p>
                  <div className="form-group"><label className="form-label">이메일</label><input type="email" className="form-input" placeholder="name@agency.com" /></div>
                  <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 8, opacity: 0.6 }} disabled>
                    재설정 링크 보내기 (준비 중)
                  </button>
                </>
              ) : (
                <>
                  <h2>새 비밀번호 설정</h2>
                  <p className="subtitle">새 비밀번호를 입력해주세요</p>
                  <div className="form-group"><label className="form-label">새 비밀번호</label><input type="password" className="form-input" placeholder="8자 이상" /></div>
                  <div className="form-group"><label className="form-label">비밀번호 확인</label><input type="password" className="form-input" placeholder="비밀번호 재입력" /></div>
                  <button className="btn btn-primary btn-lg" style={{ width: "100%", marginTop: 8 }} onClick={() => setView("login")}>
                    비밀번호 변경 완료
                  </button>
                </>
              )}
              <p style={{ textAlign: "center", marginTop: "24px", fontSize: "0.857rem" }}>
                <a href="#" onClick={(e) => { e.preventDefault(); setView("login"); setAuthError(null); }}>← 로그인으로 돌아가기</a>
              </p>
            </>
          )}
        </div>
      </div>
    {termsModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card, var(--surface))", borderRadius: 16, padding: 32, maxWidth: 560, width: "90%", maxHeight: "80vh", overflow: "auto", boxShadow: "0 25px 50px rgba(0,0,0,0.25)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3>{termsModal === "terms" ? "📋 이용약관" : "🔒 개인정보처리방침"}</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setTermsModal(null)}>✕</button>
            </div>
            {termsModal === "terms" ? (
              <div style={{ fontSize: "0.857rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                <h4>제1조 (목적)</h4>
                <p>본 약관은 Agency OS(이하 &quot;서비스&quot;)가 제공하는 네이버 검색광고 통합 관리 서비스의 이용조건 및 절차, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
                <h4>제2조 (정의)</h4>
                <p>&quot;이용자&quot;란 본 약관에 동의하고 서비스를 이용하는 자를 말합니다. &quot;광고 계정&quot;이란 네이버 검색광고 API를 통해 연동된 광고 관리 계정을 말합니다.</p>
                <h4>제3조 (서비스의 내용)</h4>
                <p>서비스는 다음 각 호의 기능을 제공합니다: 1. 멀티 계정 통합 대시보드 2. AI 기반 자동 입찰 관리 3. 키워드 성과 분석 및 추천 4. 자동 리포트 생성 및 발송 5. 수익성 분석 및 경쟁 인텔리전스</p>
                <h4>제4조 (면책)</h4>
                <p>서비스는 AI 기반 추천 및 자동화 기능을 제공하나, 실제 광고 성과에 대해 보장하지 않습니다. 이용자는 자동 입찰 설정에 대한 최종 책임을 부담합니다.</p>
              </div>
            ) : (
              <div style={{ fontSize: "0.857rem", color: "var(--text-secondary)", lineHeight: 1.8 }}>
                <h4>1. 수집하는 개인정보</h4>
                <p>회원가입 시: 이름, 이메일, 대행사명, 비밀번호(암호화 저장). 서비스 이용 시: 접속 IP, 브라우저 정보, 광고 계정 API 키.</p>
                <h4>2. 개인정보의 이용 목적</h4>
                <p>서비스 제공 및 운영, 회원 관리, 고객 지원, 서비스 개선을 위한 분석.</p>
                <h4>3. 개인정보의 보유 기간</h4>
                <p>회원 탈퇴 시까지. 단, 관계 법령에 의한 보존 의무가 있는 경우 해당 기간까지 보존합니다.</p>
                <h4>4. 제3자 제공</h4>
                <p>이용자의 동의 없이 개인정보를 제3자에게 제공하지 않습니다. 단, 네이버 검색광고 API 연동을 위해 필요한 최소 정보는 네이버에 전달될 수 있습니다.</p>
              </div>
            )}
            <button className="btn btn-primary" style={{ width: "100%", marginTop: 20 }} onClick={() => setTermsModal(null)}>확인</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginPageInner />
    </Suspense>
  );
}
