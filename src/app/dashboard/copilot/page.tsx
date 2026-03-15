"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, Bot, Lightbulb, TrendingUp, Search, DollarSign, Shield, BarChart3, Loader2 } from "lucide-react";

interface Message {
  id: number;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const quickActions = [
  { icon: TrendingUp, label: "전체 계정 성과 요약", prompt: "오늘 전체 계정 성과를 요약해줘" },
  { icon: Search, label: "키워드 추천", prompt: "현재 운영 중인 키워드 기반으로 새 키워드를 추천해줘" },
  { icon: DollarSign, label: "입찰가 최적화", prompt: "ROAS가 낮은 키워드의 입찰가 조정을 제안해줘" },
  { icon: Shield, label: "부정클릭 분석", prompt: "최근 부정클릭 의심 활동을 분석해줘" },
  { icon: BarChart3, label: "경쟁사 분석", prompt: "주요 경쟁사 대비 우리의 포지션을 분석해줘" },
  { icon: Lightbulb, label: "개선 제안", prompt: "현재 캠페인에서 개선할 수 있는 점을 알려줘" },
];

const aiResponses: Record<string, string> = {
  "오늘 전체 계정 성과를 요약해줘": `📊 **오늘 전체 계정 성과 요약**

| 지표 | 값 | 전일 대비 |
|------|-----|----------|
| 총 광고비 | ₩6,480,000 | +8% |
| 평균 ROAS | 340% | +22% |
| 총 클릭수 | 6,890 | +14% |
| 전환수 | 68건 | +18% |
| 노출수 | 43,200 | +5% |

**🔥 주요 하이라이트:**
- A 법률사무소: ROAS 380%로 최고 성과
- B 성형외과: CTR 50% 급락 → 소재 교체 권장
- C 치과의원: 예산 90% 소진 → 일예산 상향 필요

**💡 추천 액션:** B 성형외과 '쌍꺼풀수술가격' 키워드 소재 A/B 테스트를 진행하시겠어요?`,

  "현재 운영 중인 키워드 기반으로 새 키워드를 추천해줘": `🔑 **AI 키워드 추천**

현재 8개 활성 키워드를 분석한 결과, 다음 5개 키워드를 추천합니다:

| 키워드 | 월 검색량 | 경쟁도 | 예상 CPC | 예상 전환 |
|--------|----------|--------|----------|----------|
| 교통사고변호사 | 8,200 | 낮음 | ₩680 | 6건/월 |
| 상속변호사 | 5,400 | 보통 | ₩850 | 4건/월 |
| 임플란트비용 | 12,100 | 낮음 | ₩520 | 9건/월 |
| 치아교정가격 | 9,800 | 보통 | ₩620 | 7건/월 |
| 중학수학학원 | 6,300 | 낮음 | ₩380 | 11건/월 |

**📈 예상 효과:** 월 ₩1,250,000 추가 투자 시 전환 37건 예상 (ROAS 420%)

키워드 관리 페이지에서 바로 추가하시겠어요?`,

  "ROAS가 낮은 키워드의 입찰가 조정을 제안해줘": `💰 **입찰가 최적화 제안**

ROAS 기준 하위 3개 키워드를 분석했습니다:

**1. 코성형후기** (B 성형외과)
- 현재 ROAS: 52% ❌
- 현재 입찰가: ₩1,800
- 📉 제안: ₩1,500으로 하향 (-17%)
- 예상 효과: ROAS 78%로 개선

**2. 인테리어견적** (F 인테리어)
- 현재 ROAS: 109%
- 현재 입찰가: ₩700
- 📉 제안: ₩600으로 하향 (-14%)
- 예상 효과: ROAS 145%로 개선

**3. 이혼변호사** (A 법률사무소)
- 현재 ROAS: 77%
- 현재 입찰가: ₩900
- ✅ 제안: 유지 (전환율 상승 추세)

전체 적용하시겠어요? 자동화 페이지에서 전략을 설정할 수도 있습니다.`,

  "최근 부정클릭 의심 활동을 분석해줘": `🛡️ **부정클릭 분석 보고서**

최근 7일간 48,230건의 클릭 중 **2,415건(5.0%)**이 의심 클릭으로 탐지되었습니다.

**🔴 고위험 IP (즉시 차단 권장):**
- 203.xxx.xxx.12: 동일 IP에서 '형사변호사' 3회 연속 클릭 (10분 이내)
- 패턴: 클릭 후 1초 이내 이탈 → 봇 가능성 높음

**🟡 중위험 이벤트:**
- '이혼변호사': 118.xxx.xxx.45에서 비정상 세션 패턴
- '쌍꺼풀수술가격': 211.xxx.xxx.88에서 VPN 접속 탐지

**💰 절감액:** 차단 IP로 인한 예상 절감액 ₩350,000/주

키워드 관리 > 부정클릭 방지 탭에서 상세 확인 및 IP 차단이 가능합니다.`,

  "주요 경쟁사 대비 우리의 포지션을 분석해줘": `🕵️ **경쟁사 포지션 분석**

'형사변호사' 키워드 기준 주요 경쟁사 비교:

| 경쟁사 | 순위 | 예상 입찰가 | 소재 변경 | 위협도 |
|--------|------|-----------|----------|--------|
| 우리 (A 법률사무소) | **1위** | ₩1,200 | - | - |
| 법무법인 정의 | 2위 | ₩1,150 | 3일 전 | 🟡 중간 |
| 한빛 법률사무소 | 3위 | ₩1,080 | 변동 없음 | 🟢 낮음 |
| 최강 변호사 | 4위 | ₩950 | 1주 전 | 🟢 낮음 |

**📌 주요 인사이트:**
- '법무법인 정의'가 3일 전 소재를 변경하며 CTR 상승 중 → 주시 필요
- 전체적으로 1위 유지 중이나, 입찰가 격차가 ₩50으로 좁혀지고 있음

경쟁 분석 페이지에서 실시간 모니터링을 확인하세요.`,

  "현재 캠페인에서 개선할 수 있는 점을 알려줘": `💡 **캠페인 개선 제안 TOP 5**

**1. 🔥 B 성형외과 — CTR 급락 대응 (긴급)**
- CTR이 50% 급락했습니다. 광고 소재 피로도가 원인으로 보입니다.
- 💡 제안: 소재 A/B 테스트 진행 (새 소재 2~3개 추가)

**2. 💰 C 치과의원 — 예산 조정 필요**
- 일예산의 90%가 오전에 소진됩니다.
- 💡 제안: 시간대 차등 입찰 활성화 (오후 시간대 강화)

**3. 📈 E 학원 — 15~18시 골든타임 활용**
- 15~18시 전환율이 평균 대비 2.3배 높습니다.
- 💡 제안: 해당 시간대 입찰가 +20% 자동 설정

**4. 🔑 A 법률사무소 — 새 키워드 추가 기회**
- '교통사고변호사' 키워드 (월 8,200검색) 미등록
- 💡 제안: 키워드 추가 후 목표 CPC ₩680 설정

**5. 📋 리포트 자동화**
- 현재 수동으로 리포트를 생성 중입니다.
- 💡 제안: 주간 자동 발송 설정 (매주 월요일 AM 9:00)

각 제안을 실행하시겠어요?`,
};

function getAIResponse(input: string): string {
  // Check for exact match first
  if (aiResponses[input]) return aiResponses[input];

  // Check for keyword-based matching
  const inputLower = input.toLowerCase();
  if (inputLower.includes("성과") || inputLower.includes("요약") || inputLower.includes("현황")) {
    return aiResponses["오늘 전체 계정 성과를 요약해줘"];
  }
  if (inputLower.includes("키워드") && (inputLower.includes("추천") || inputLower.includes("새"))) {
    return aiResponses["현재 운영 중인 키워드 기반으로 새 키워드를 추천해줘"];
  }
  if (inputLower.includes("입찰") || inputLower.includes("roas")) {
    return aiResponses["ROAS가 낮은 키워드의 입찰가 조정을 제안해줘"];
  }
  if (inputLower.includes("부정") || inputLower.includes("클릭") || inputLower.includes("fraud")) {
    return aiResponses["최근 부정클릭 의심 활동을 분석해줘"];
  }
  if (inputLower.includes("경쟁") || inputLower.includes("competitor")) {
    return aiResponses["주요 경쟁사 대비 우리의 포지션을 분석해줘"];
  }
  if (inputLower.includes("개선") || inputLower.includes("제안") || inputLower.includes("개선점")) {
    return aiResponses["현재 캠페인에서 개선할 수 있는 점을 알려줘"];
  }

  return `안녕하세요! 말씀하신 "${input}"에 대해 분석해보겠습니다.

현재 6개 광고 계정의 데이터를 기반으로 답변 드리겠습니다:

📊 **전체 성과 개요:**
- 총 광고비: ₩6,480,000 (오늘)
- 평균 ROAS: 340%
- 활성 키워드: 2,847개

더 구체적인 분석이 필요하시면 아래 질문을 시도해보세요:
- "전체 계정 성과를 요약해줘"
- "키워드 추천해줘"
- "입찰가 최적화 제안해줘"
- "부정클릭 분석해줘"`;
}

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 0,
      role: "assistant",
      content: "안녕하세요! 👋 Agency OS AI 코파일럿입니다.\n\n광고 성과 분석, 키워드 추천, 입찰가 최적화 등을 도와드릴 수 있습니다. 아래 빠른 액션 버튼을 클릭하거나, 궁금한 내용을 자유롭게 물어보세요!",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isTyping) return;

    const userMsg: Message = { id: Date.now(), role: "user", content: text, timestamp: new Date() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsTyping(true);

    let aiResponse: string;
    try {
      // 실제 API 호출 시도
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const json = await res.json();
        aiResponse = json.data?.response ?? getAIResponse(text);
      } else {
        // API 실패 시 로컬 폴백
        aiResponse = getAIResponse(text);
      }
    } catch {
      // 네트워크 오류 시 로컬 폴백
      aiResponse = getAIResponse(text);
    }

    const aiMsg: Message = { id: Date.now() + 1, role: "assistant", content: aiResponse, timestamp: new Date() };
    setMessages((prev) => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles size={22} color="var(--primary)" /> AI 코파일럿
        </h1>
        <div className="main-header-actions">
          <span style={{ fontSize: "0.786rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, background: "var(--success)", borderRadius: "50%", display: "inline-block" }} />
            연결됨 · 6개 계정 분석 중
          </span>
        </div>
      </header>

      <div className="main-body" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)", padding: 0 }}>
        {/* Quick Actions (show only when few messages) */}
        {messages.length <= 1 && (
          <div style={{ padding: "16px 24px" }}>
            <div style={{ fontSize: "0.857rem", fontWeight: 600, color: "var(--text-secondary)", marginBottom: 12 }}>
              💡 빠른 질문
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {quickActions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={() => sendMessage(action.prompt)}
                    style={{
                      display: "flex", alignItems: "center", gap: 10, padding: "14px 16px",
                      border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                      background: "var(--surface)", cursor: "pointer", textAlign: "left",
                      transition: "all var(--transition)", fontSize: "0.857rem",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "var(--primary-light)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
                  >
                    <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: "var(--primary-light)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Icon size={18} />
                    </div>
                    <span style={{ fontWeight: 500 }}>{action.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Chat Messages */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
          {messages.map((msg) => (
            <div key={msg.id} style={{ display: "flex", gap: 12, alignItems: "flex-start", flexDirection: msg.role === "user" ? "row-reverse" : "row" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: msg.role === "user" ? "var(--primary)" : "linear-gradient(135deg, #7C3AED, var(--primary))",
                display: "flex", alignItems: "center", justifyContent: "center", color: "white",
              }}>
                {msg.role === "user" ? <User size={18} /> : <Bot size={18} />}
              </div>
              <div style={{
                maxWidth: "75%", padding: "14px 18px",
                borderRadius: msg.role === "user" ? "var(--radius-xl) var(--radius-xl) 4px var(--radius-xl)" : "var(--radius-xl) var(--radius-xl) var(--radius-xl) 4px",
                background: msg.role === "user" ? "var(--primary)" : "var(--surface-hover)",
                color: msg.role === "user" ? "white" : "var(--text-primary)",
                fontSize: "0.929rem", lineHeight: 1.7, whiteSpace: "pre-wrap",
              }}>
                {msg.content}
              </div>
            </div>
          ))}

          {isTyping && (
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
              <div style={{
                width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                background: "linear-gradient(135deg, #7C3AED, var(--primary))",
                display: "flex", alignItems: "center", justifyContent: "center", color: "white",
              }}>
                <Bot size={18} />
              </div>
              <div style={{
                padding: "14px 18px", borderRadius: "var(--radius-xl) var(--radius-xl) var(--radius-xl) 4px",
                background: "var(--surface-hover)", display: "flex", alignItems: "center", gap: 8,
                color: "var(--text-muted)", fontSize: "0.857rem",
              }}>
                <Loader2 size={16} className="spin" /> 분석 중...
              </div>
            </div>
          )}

          <div ref={chatEndRef} />
        </div>

        {/* Input Bar */}
        <form onSubmit={handleSubmit} style={{
          padding: "16px 24px", borderTop: "1px solid var(--border)",
          display: "flex", gap: 12, background: "var(--surface)",
        }}>
          <input
            className="form-input"
            placeholder="AI에게 질문하세요... (예: 오늘 성과 요약해줘)"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={isTyping}
            style={{ flex: 1 }}
          />
          <button type="submit" className="btn btn-primary" disabled={!input.trim() || isTyping}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Send size={16} /> 전송
          </button>
        </form>
      </div>
    </>
  );
}
