"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, User, Bot, Lightbulb, TrendingUp, Search, DollarSign, Shield, BarChart3, Loader2, Trash2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

export default function CopilotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [mounted, setMounted] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
    const saved = localStorage.getItem("copilot_chat");
    const initMsg: Message = {
      id: 0,
      role: "assistant",
      content: "안녕하세요! 👋 Agency OS AI 코파일럿입니다.\n\n광고 성과 분석, 키워드 추천, 입찰가 최적화 등을 도와드릴 수 있습니다. 아래 빠른 액션 버튼을 클릭하거나, 궁금한 내용을 자유롭게 물어보세요!",
      timestamp: new Date(),
    };

    if (saved) {
      try {
        setMessages(JSON.parse(saved));
      } catch {
        setMessages([initMsg]);
      }
    } else {
      setMessages([initMsg]);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("copilot_chat", JSON.stringify(messages));
    }
  }, [messages, mounted]);

  const clearChat = () => {
    if (confirm("채팅 내역을 모두 지우시겠습니까?")) {
      setMessages([{
        id: Date.now(),
        role: "assistant",
        content: "안녕하세요! 👋 Agency OS AI 코파일럿입니다.\n\n광고 성과 분석, 키워드 추천, 입찰가 최적화 등을 도와드릴 수 있습니다. 아래 빠른 액션 버튼을 클릭하거나, 궁금한 내용을 자유롭게 물어보세요!",
        timestamp: new Date(),
      }]);
    }
  };

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
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text }),
      });
      if (res.ok) {
        const json = await res.json();
        aiResponse = json.data?.response ?? '응답을 처리할 수 없습니다. 다시 시도해주세요.';
      } else if (res.status === 429) {
        aiResponse = '⚠️ 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';
      } else {
        aiResponse = '서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      }
    } catch {
      aiResponse = '네트워크 연결을 확인해주세요. 서버에 연결할 수 없습니다.';
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
          <button className="btn btn-ghost btn-sm" onClick={clearChat} title="대화 내용 지우기">
            <Trash2 size={16} /> 초기화
          </button>
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
                fontSize: "0.929rem", lineHeight: 1.7,
                ...(msg.role === "user" ? { whiteSpace: "pre-wrap" as const } : {}),
              }}>
                {msg.role === "user" ? (
                  msg.content
                ) : (
                  <div className="markdown-content">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {msg.content}
                    </ReactMarkdown>
                  </div>
                )}
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
