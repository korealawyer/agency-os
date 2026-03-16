"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, Download, Upload, Sparkles, TrendingUp, TrendingDown, Shield, Filter, CheckCircle2, Clock, X, Plus, AlertTriangle, Settings2 } from "lucide-react";
import { downloadCsv } from "@/utils/export";
import { parseCSV, readFileAsText } from "@/utils/csv";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useToast } from "@/components/Toast";
import { useKeywords, useClickFraudEvents, useBlockedIps, useAccounts, apiMutate } from "@/hooks/useApi";
import { KpiSkeleton } from "@/components/Skeleton";
import Breadcrumb from "@/components/Breadcrumb";
import KeywordTable, { type SortKey, type KeywordRow } from "@/components/KeywordTable";

type ViewTab = "keywords" | "rank" | "fraud";

const initialKeywords = [
  { id: 1, text: "형사변호사", group: "형사_파워링크", account: "A 법률사무소", bid: 1200, rank: 1, strategy: "target_rank", qi: 9, impressions: 4200, clicks: 280, ctr: 6.7, cpc: 890, conversions: 12, cost: 249200, trend: "up" },
  { id: 2, text: "이혼변호사", group: "이혼_파워링크", account: "A 법률사무소", bid: 900, rank: 3, strategy: "target_cpc", qi: 7, impressions: 3100, clicks: 180, ctr: 5.8, cpc: 720, conversions: 5, cost: 129600, trend: "down" },
  { id: 3, text: "쌍꺼풀수술가격", group: "눈성형_파워링크", account: "B 성형외과", bid: 2500, rank: 2, strategy: "target_rank", qi: 6, impressions: 8900, clicks: 420, ctr: 4.7, cpc: 1800, conversions: 3, cost: 756000, trend: "up" },
  { id: 4, text: "코성형후기", group: "코성형_파워링크", account: "B 성형외과", bid: 1800, rank: 5, strategy: "manual", qi: 5, impressions: 5200, clicks: 210, ctr: 4.0, cpc: 1650, conversions: 1, cost: 346500, trend: "down" },
  { id: 5, text: "임플란트가격", group: "임플란트_파워링크", account: "C 치과의원", bid: 800, rank: 2, strategy: "target_roas", qi: 8, impressions: 6100, clicks: 320, ctr: 5.2, cpc: 480, conversions: 15, cost: 153600, trend: "up" },
  { id: 6, text: "수학학원추천", group: "수학_파워링크", account: "E 학원", bid: 600, rank: 1, strategy: "target_rank", qi: 9, impressions: 3800, clicks: 250, ctr: 6.6, cpc: 420, conversions: 18, cost: 105000, trend: "up" },
  { id: 7, text: "인테리어견적", group: "견적_파워링크", account: "F 인테리어", bid: 700, rank: 4, strategy: "target_cpc", qi: 7, impressions: 4500, clicks: 190, ctr: 4.2, cpc: 580, conversions: 6, cost: 110200, trend: "down" },
  { id: 8, text: "개인회생", group: "채무_파워링크", account: "A 법률사무소", bid: 1500, rank: 2, strategy: "target_rank", qi: 8, impressions: 5600, clicks: 340, ctr: 6.1, cpc: 1100, conversions: 9, cost: 374000, trend: "up" },
];

const aiRecommendedKeywords = [
  { text: "교통사고변호사", searchVol: 8200, competition: "낮음", estCpc: 680, estConv: 6 },
  { text: "상속변호사", searchVol: 5400, competition: "보통", estCpc: 850, estConv: 4 },
  { text: "임플란트비용", searchVol: 12100, competition: "낮음", estCpc: 520, estConv: 9 },
  { text: "치아교정가격", searchVol: 9800, competition: "보통", estCpc: 620, estConv: 7 },
  { text: "중학수학학원", searchVol: 6300, competition: "낮음", estCpc: 380, estConv: 11 },
];

type FraudEvent = { id: number; time: string; keyword: string; ip: string; risk: string; status: string };
const initialFraudEvents: FraudEvent[] = [
  { id: 1, time: "10:05", keyword: "형사변호사", ip: "203.xxx.xxx.12", risk: "high", status: "pending" },
  { id: 2, time: "10:03", keyword: "형사변호사", ip: "203.xxx.xxx.12", risk: "high", status: "pending" },
  { id: 3, time: "09:45", keyword: "이혼변호사", ip: "118.xxx.xxx.45", risk: "medium", status: "pending" },
  { id: 4, time: "09:30", keyword: "쌍꺼풀수술가격", ip: "211.xxx.xxx.88", risk: "medium", status: "cleared" },
  { id: 5, time: "09:12", keyword: "형사변호사", ip: "203.xxx.xxx.12", risk: "high", status: "blocked" },
  { id: 6, time: "08:55", keyword: "임플란트가격", ip: "175.xxx.xxx.67", risk: "low", status: "cleared" },
];

const blockedIPs = [
  { ip: "203.xxx.xxx.12", blockedAt: "2026-03-12", reason: "동일 IP 반복 클릭 (R1)", status: "active" },
  { ip: "211.xxx.xxx.99", blockedAt: "2026-03-11", reason: "비정상 세션 패턴 (R2)", status: "active" },
  { ip: "118.xxx.xxx.33", blockedAt: "2026-03-10", reason: "VPN/프록시 탐지 (R3)", status: "expired" },
];

const bidHistory = [
  { time: "03/12 10:05", keyword: "형사변호사", from: 1250, to: 1200, by: "AI", reason: "목표 순위 유지" },
  { time: "03/12 09:30", keyword: "쌍꺼풀수술가격", from: 2600, to: 2500, by: "AI", reason: "CPC 초과 방지" },
  { time: "03/11 18:00", keyword: "임플란트가격", from: 780, to: 800, by: "김대행", reason: "수동 조정" },
  { time: "03/11 15:30", keyword: "개인회생", from: 1550, to: 1500, by: "AI", reason: "일예산 초과 방지" },
  { time: "03/11 09:00", keyword: "수학학원추천", from: 580, to: 600, by: "AI", reason: "순위 하락 방어" },
];

const rankTrendData = [
  { date: "3/6", 형사변호사: 2, 임플란트가격: 3, 수학학원추천: 1, 쌍꺼풀수술가격: 3 },
  { date: "3/7", 형사변호사: 1, 임플란트가격: 2, 수학학원추천: 2, 쌍꺼풀수술가격: 2 },
  { date: "3/8", 형사변호사: 1, 임플란트가격: 2, 수학학원추천: 1, 쌍꺼풀수술가격: 3 },
  { date: "3/9", 형사변호사: 2, 임플란트가격: 3, 수학학원추천: 1, 쌍꺼풀수술가격: 4 },
  { date: "3/10", 형사변호사: 1, 임플란트가격: 2, 수학학원추천: 1, 쌍꺼풀수술가격: 2 },
  { date: "3/11", 형사변호사: 1, 임플란트가격: 2, 수학학원추천: 1, 쌍꺼풀수술가격: 2 },
  { date: "3/12", 형사변호사: 1, 임플란트가격: 2, 수학학원추천: 1, 쌍꺼풀수술가격: 2 },
];

const strategyLabels: Record<string, string> = {
  target_rank: "목표 순위", target_cpc: "목표 CPC", target_roas: "목표 ROAS",
  max_conversion: "최대 전환", time_based: "시간대 차등", manual: "수동",
};

type SortDir = "asc" | "desc";

const allColumns = [
  { key: "text", label: "키워드", default: true },
  { key: "account", label: "계정", default: false },
  { key: "group", label: "광고그룹", default: false },
  { key: "bid", label: "입찰가", default: true },
  { key: "rank", label: "순위", default: true },
  { key: "strategy", label: "전략", default: true },
  { key: "qi", label: "품질", default: false },
  { key: "impressions", label: "노출", default: false },
  { key: "clicks", label: "클릭", default: false },
  { key: "ctr", label: "CTR", default: true },
  { key: "cpc", label: "CPC", default: false },
  { key: "conversions", label: "전환", default: true },
  { key: "cost", label: "비용", default: true },
];

export default function KeywordsPage() {
  const [viewTab, setViewTab] = useState<ViewTab>("keywords");
  const [selectedKws, setSelectedKws] = useState<Set<number>>(new Set());
  const [selectedFraud, setSelectedFraud] = useState<Set<number>>(new Set());
  const [editingBid, setEditingBid] = useState<number | null>(null);
  const [editBidValue, setEditBidValue] = useState("");
  const [keywords, setKeywords] = useState(initialKeywords);
  const [showAiModal, setShowAiModal] = useState(false);
  const [addedRecommendations, setAddedRecommendations] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("전체 계정");
  const [strategyFilter, setStrategyFilter] = useState("전체 전략");
  const [fraudEvents, setFraudEvents] = useState(initialFraudEvents);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const { addToast } = useToast();

  // ── API 데이터 페칭 (폴백 지원) ──
  const { data: apiKeywords, isLoading: kwLoading } = useKeywords(1, 100);
  const { data: apiFraudEvents } = useClickFraudEvents();
  const { data: apiBlockedIps } = useBlockedIps();
  const { data: accountsData } = useAccounts(1, 100);
  const dynamicAccounts = ["전체 계정", ...(accountsData?.map((a: any) => a.customerName || a.name).filter(Boolean) ?? [])];

  // API 데이터가 있으면 로컬 상태 갱신
  useEffect(() => {
    if (apiKeywords?.length > 0) {
      setKeywords(apiKeywords.map((k: any, i: number) => ({
        id: k.id ?? i + 1,
        text: k.keywordText ?? '',
        group: k.adGroupId ?? '',
        account: k.accountName ?? '',
        bid: Number(k.currentBid ?? 0),
        rank: k.targetRank ?? 0,
        strategy: k.bidStrategy ?? 'manual',
        qi: k.qualityIndex ?? 0,
        impressions: k.impressions ?? 0,
        clicks: k.clicks ?? 0,
        ctr: Number(k.ctr ?? 0) * 100,
        cpc: Number(k.cpc ?? 0),
        conversions: k.conversions ?? 0,
        cost: Number(k.cost ?? 0),
        trend: k.conversions > 5 ? 'up' : 'down',
      })));
    }
  }, [apiKeywords]);

  // Sorting state
  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Column visibility
  const [visibleCols, setVisibleCols] = useState<Set<string>>(new Set(allColumns.filter(c => c.default).map(c => c.key)));
  const [showColPanel, setShowColPanel] = useState(false);

  // Inline strategy edit
  const [editingStrategy, setEditingStrategy] = useState<number | null>(null);

  const toggleCol = (key: string) => {
    setVisibleCols(prev => {
      const next = new Set(prev);
      if (next.has(key)) { if (next.size > 3) next.delete(key); } else { next.add(key); }
      return next;
    });
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const changeStrategy = (kwId: number, newStrategy: string) => {
    const kw = keywords.find(k => k.id === kwId);
    setKeywords(prev => prev.map(k => k.id === kwId ? { ...k, strategy: newStrategy } : k));
    addToast("success", "전략 변경", `'${kw?.text}' 전략이 '${strategyLabels[newStrategy]}'(으)로 변경되었습니다.`);
    setEditingStrategy(null);
  };

  const saveBid = async (id: number) => {
    const newBid = parseInt(editBidValue);
    if (isNaN(newBid) || newBid <= 0) { setEditingBid(null); return; }
    const kw = keywords.find((k) => k.id === id);
    // Optimistic UI 업데이트 (즉시 반영)
    setKeywords((prev) => prev.map((k) => k.id === id ? { ...k, bid: newBid } : k));
    setEditingBid(null);
    try {
      await apiMutate(`/api/keywords/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ newBid, reason: '수동 변경' }),
      });
      addToast("success", "입찰가 변경 완료", `'${kw?.text}' ₩${kw?.bid.toLocaleString()} → ₩${newBid.toLocaleString()}`);
    } catch (err: any) {
      // 실패 시 롤백
      setKeywords((prev) => prev.map((k) => k.id === id ? { ...k, bid: kw!.bid } : k));
      addToast("error", "입찰가 변경 실패", err?.message ?? '서버 오류');
    }
  };

  const toggleKw = (id: number) => {
    setSelectedKws((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };
  const toggleAllKw = () => {
    setSelectedKws((prev) => prev.size === keywords.length ? new Set() : new Set(keywords.map((k) => k.id)));
  };
  const toggleFraud = (id: number) => {
    setSelectedFraud((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const strategyMap: Record<string, string> = { "전체 전략": "", "목표 순위": "target_rank", "목표 CPC": "target_cpc", "목표 ROAS": "target_roas", "수동": "manual" };
  const filteredKeywords = keywords.filter((kw) => {
    if (searchQuery && !kw.text.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (accountFilter !== "전체 계정" && kw.account !== accountFilter) return false;
    if (strategyFilter !== "전체 전략" && kw.strategy !== strategyMap[strategyFilter]) return false;
    return true;
  }).sort((a, b) => {
    if (!sortKey) return 0;
    const av = a[sortKey as keyof typeof a];
    const bv = b[sortKey as keyof typeof b];
    const cmp = typeof av === "number" && typeof bv === "number" ? av - bv : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  // ── 일괄 입찎 변경 (API 연동 + 낙관적 UI + 롤백) ──
  const bulkBidChange = async (delta: number) => {
    if (isBulkLoading) return;
    const affected = keywords.filter((k) => selectedKws.has(k.id));
    if (affected.length === 0) return;
    const prevKeywords = [...keywords]; // 롤백용 스냅샷

    // 1. 낙관적 UI 업데이트
    setKeywords((prev) => prev.map((k) => selectedKws.has(k.id) ? { ...k, bid: Math.max(70, k.bid + delta) } : k));
    setSelectedKws(new Set());
    setIsBulkLoading(true);

    try {
      // 2. 병렬 API 호출 (부분 실패 허용)
      const results = await Promise.allSettled(
        affected.map((kw) =>
          apiMutate(`/api/keywords/${kw.id}`, {
            method: 'PUT',
            body: JSON.stringify({ newBid: Math.max(70, kw.bid + delta), reason: `일괄 ${delta > 0 ? '+' : ''}${delta}원 조정` }),
          })
        )
      );
      const failCount = results.filter((r) => r.status === 'rejected').length;
      if (failCount > 0) {
        addToast('warning', `일부 실패`, `${affected.length}개 중 ${failCount}개 API 오류 발생`);
      } else {
        addToast('success', `입찎가 ${delta > 0 ? '+' : ''}${delta}원 일괄 변경`, `${affected.length}개 키워드 적용 완료`);
      }
    } catch {
      // 3. 전체 실패 시 롤백
      setKeywords(prevKeywords);
      setSelectedKws(new Set(affected.map((k) => k.id)));
      addToast('error', '일괄 변경 실패', '서버 오류로 변경이 취소되었습니다.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const bulkBidChangePct = async (pct: number) => {
    if (isBulkLoading) return;
    const affected = keywords.filter((k) => selectedKws.has(k.id));
    if (affected.length === 0) return;
    const prevKeywords = [...keywords];

    setKeywords((prev) => prev.map((k) =>
      selectedKws.has(k.id) ? { ...k, bid: Math.max(70, Math.round(k.bid * (1 + pct / 100))) } : k
    ));
    setSelectedKws(new Set());
    setIsBulkLoading(true);

    try {
      const results = await Promise.allSettled(
        affected.map((kw) =>
          apiMutate(`/api/keywords/${kw.id}`, {
            method: 'PUT',
            body: JSON.stringify({ newBid: Math.max(70, Math.round(kw.bid * (1 + pct / 100))), reason: `일괄 ${pct > 0 ? '+' : ''}${pct}% 조정` }),
          })
        )
      );
      const failCount = results.filter((r) => r.status === 'rejected').length;
      if (failCount > 0) {
        addToast('warning', `일부 실패`, `${affected.length}개 중 ${failCount}개 API 오류`);
      } else {
        addToast('success', `입찎가 ${pct > 0 ? '+' : ''}${pct}% 일괄 변경`, `${affected.length}개 키워드 적용 완료`);
      }
    } catch {
      setKeywords(prevKeywords);
      setSelectedKws(new Set(affected.map((k) => k.id)));
      addToast('error', '일괄 변경 실패', '서버 오류로 변경이 취소되었습니다.');
    } finally {
      setIsBulkLoading(false);
    }
  };

  const bulkOff = () => {
    setKeywords((prev) => prev.filter((k) => !selectedKws.has(k.id)));
    addToast("info", "키워드 OFF", `${selectedKws.size}개 키워드가 비활성화되었습니다.`);
    setSelectedKws(new Set());
  };

  const handleFraudAction = (action: "block" | "refund" | "normal") => {
    const count = selectedFraud.size;
    setFraudEvents((prev) => prev.map((e) =>
      selectedFraud.has(e.id) ? { ...e, status: action === "block" ? "차단됨" : action === "refund" ? "환급 신청" : "정상 처리" } : e
    ));
    const labels = { block: "IP 차단", refund: "환급 신청", normal: "정상 처리" };
    addToast("success", `${labels[action]} 완료`, `${count}건의 이벤트가 ${labels[action]}되었습니다.`);
    setSelectedFraud(new Set());
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">키워드 관리</h1>
        <div className="main-header-actions">
          {viewTab === "keywords" && (
            <>
              <button className="btn btn-secondary" onClick={() => {
                downloadCsv("키워드_데이터", ["키워드", "계정", "광고그룹", "입찰가", "순위", "전략", "품질", "노출", "클릭", "CTR", "CPC", "전환", "비용"],
                  keywords.map((k) => [k.text, k.account, k.group, String(k.bid), String(k.rank), strategyLabels[k.strategy] || k.strategy, String(k.qi), String(k.impressions), String(k.clicks), String(k.ctr), String(k.cpc), String(k.conversions), String(k.cost)]));
                addToast("success", "CSV 내보내기 완료", `${keywords.length}개 키워드 데이터가 다운로드되었습니다.`);
              }}><Download size={16} /> CSV 내보내기</button>
              <label className="btn btn-secondary" style={{ cursor: "pointer" }}>
                <Upload size={16} /> CSV 가져오기
                <input type="file" accept=".csv" style={{ display: "none" }} onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const text = await readFileAsText(file);
                    const { headers, rows, rowCount } = parseCSV(text);
                    if (rowCount === 0) { addToast("error", "빈 파일입니다"); return; }
                    const kwIdx = headers.findIndex((h) => h.includes("키워드") || h.toLowerCase().includes("keyword") || h === "text");
                    const bidIdx = headers.findIndex((h) => h.includes("입찰") || h.toLowerCase().includes("bid"));
                    const accIdx = headers.findIndex((h) => h.includes("계정") || h.toLowerCase().includes("account"));
                    const groupIdx = headers.findIndex((h) => h.includes("그룹") || h.toLowerCase().includes("group"));
                    let added = 0;
                    const newKws = rows.map((row, i) => {
                      const text = kwIdx >= 0 ? row[kwIdx] : row[0];
                      if (!text || !text.trim()) return null;
                      added++;
                      return {
                        id: Math.max(...keywords.map((k) => k.id), 100) + i + 1,
                        text: text.trim(),
                        group: groupIdx >= 0 ? row[groupIdx] || "CSV_임포트" : "CSV_임포트",
                        account: accIdx >= 0 ? row[accIdx] || "미지정" : "미지정",
                        bid: bidIdx >= 0 ? parseInt(row[bidIdx]) || 500 : 500,
                        rank: 0, strategy: "manual", qi: 5,
                        impressions: 0, clicks: 0, ctr: 0, cpc: 0,
                        conversions: 0, cost: 0, trend: "up" as const,
                      };
                    }).filter(Boolean) as typeof keywords;
                    setKeywords((prev) => [...prev, ...newKws]);
                    addToast("success", "CSV 가져오기 완료", `'${file.name}'에서 ${added}개 키워드를 가져왔습니다.`);
                  } catch {
                    addToast("error", "CSV 파싱 실패", "파일 형식을 확인해주세요.");
                  }
                  e.target.value = "";
                }} />
              </label>
              <button className="btn btn-primary" onClick={() => setShowAiModal(true)}><Sparkles size={16} /> AI 키워드 추천</button>
            </>
          )}
        </div>
      </header>
      <div className="main-body">
        {/* 5-G: View Tabs */}
        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", padding: 3, width: "fit-content" }}>
          <button className={`btn btn-sm ${viewTab === "keywords" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewTab("keywords")}>🔑 키워드</button>
          <button className={`btn btn-sm ${viewTab === "rank" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewTab("rank")}>📊 순위</button>
          <button className={`btn btn-sm ${viewTab === "fraud" ? "btn-primary" : "btn-ghost"}`} onClick={() => setViewTab("fraud")}>🛡️ 부정클릭 방지</button>
        </div>

        {viewTab === "keywords" && (
          <>
            {/* AI Banner */}
            <div className="card ai-panel" style={{ marginBottom: 24, padding: "16px 24px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Sparkles size={20} color="var(--primary)" />
                  <div>
                    <strong>AI 추천 키워드 5건</strong>
                    <span style={{ marginLeft: 8, color: "var(--text-secondary)", fontSize: "0.857rem" }}>저비용 고효율 키워드를 발견했습니다</span>
                  </div>
                </div>
                <button className="btn btn-primary btn-sm" onClick={() => setShowAiModal(true)}>추천 보기</button>
              </div>
            </div>

            {/* Filters */}
            <div style={{ display: "flex", gap: 12, marginBottom: 16 }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: 10 }} />
                <input className="form-input" placeholder="키워드 검색..." style={{ paddingLeft: 32 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <select className="form-input" style={{ width: 180 }} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
                {dynamicAccounts.length > 1
                  ? dynamicAccounts.map(opt => <option key={opt}>{opt}</option>)
                  : (<>
                      <option>전체 계정</option>
                      <option>A 법률사무소</option>
                      <option>B 성형외과</option>
                      <option>C 치과의원</option>
                    </>)
                }
              </select>
              <select className="form-input" style={{ width: 160 }} value={strategyFilter} onChange={(e) => setStrategyFilter(e.target.value)}><option>전체 전략</option><option>목표 순위</option><option>목표 CPC</option><option>목표 ROAS</option><option>수동</option></select>
              <button
                className={`btn ${(searchQuery || accountFilter !== '전체 계정' || strategyFilter !== '전체 전략') ? 'btn-secondary' : 'btn-ghost'}`}
                onClick={() => { setSearchQuery(""); setAccountFilter("전체 계정"); setStrategyFilter("전체 전략"); }}
                title="필터 초기화"
              >
                <Filter size={16} />
                {(searchQuery || accountFilter !== '전체 계정' || strategyFilter !== '전체 전략') && <span style={{ fontSize: '0.786rem' }}>초기화</span>}
              </button>
              {/* Column Toggle */}
              <div style={{ position: "relative" }}>
                <button className="btn btn-secondary" onClick={() => setShowColPanel(p => !p)} title="컬럼 설정"><Settings2 size={16} /></button>
                {showColPanel && (
                  <div className="column-toggle-panel">
                    <div style={{ fontWeight: 600, marginBottom: 8, fontSize: "0.857rem" }}>표시할 컬럼 ({visibleCols.size}개)</div>
                    {allColumns.map(col => (
                      <label key={col.key} className="column-toggle-item">
                        <input type="checkbox" checked={visibleCols.has(col.key)} onChange={() => toggleCol(col.key)} />
                        {col.label}
                      </label>
                    ))}
                    <button className="btn btn-ghost btn-sm" style={{ marginTop: 8, width: "100%" }} onClick={() => setVisibleCols(new Set(allColumns.filter(c => c.default).map(c => c.key)))}>기본값 복원</button>
                  </div>
                )}
              </div>
            </div>

            {/* 5-B: Bulk Action Bar */}
            {selectedKws.size > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16, padding: "10px 16px", background: "var(--primary-light)", borderRadius: "var(--radius-lg)", alignItems: "center", flexWrap: "wrap" }}>
                <span style={{ fontSize: "0.857rem", color: "var(--primary)", fontWeight: 600 }}>{selectedKws.size}개 선택됨:</span>
                <button className="btn btn-sm btn-secondary" disabled={isBulkLoading} onClick={() => bulkBidChange(100)}>입찰가 +100원</button>
                <button className="btn btn-sm btn-secondary" disabled={isBulkLoading} onClick={() => bulkBidChange(-100)}>입찰가 -100원</button>
                <button className="btn btn-sm btn-secondary" disabled={isBulkLoading} onClick={() => bulkBidChangePct(10)}>+10%</button>
                <button className="btn btn-sm btn-secondary" disabled={isBulkLoading} onClick={() => bulkBidChangePct(-10)}>-10%</button>
                <button className="btn btn-sm btn-secondary" disabled={isBulkLoading} onClick={() => { setKeywords((prev) => prev.map((k) => selectedKws.has(k.id) ? { ...k, strategy: "target_cpc" } : k)); addToast("success", "전략 변경", `${selectedKws.size}개 키워드 전략이 '목표 CPC'로 변경되었습니다.`); setSelectedKws(new Set()); }}>전략 변경</button>
                <button className="btn btn-sm btn-secondary" disabled={isBulkLoading} style={{ color: "var(--error)" }} onClick={bulkOff}>OFF</button>
                {isBulkLoading && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>저장 중...</span>}
              </div>
            )}

            {/* Keyword Table — KeywordTable 컴포넌트 사용 (Hook 규칙 위반 수정) */}
            <div className="card">
              <KeywordTable
                keywords={filteredKeywords as KeywordRow[]}
                selectedKws={selectedKws}
                visibleCols={visibleCols}
                sortKey={sortKey}
                sortDir={sortDir}
                editingBid={editingBid}
                editBidValue={editBidValue}
                editingStrategy={editingStrategy}
                onToggleAll={toggleAllKw}
                onToggleRow={toggleKw}
                onSort={handleSort}
                onBidClick={(id, bid) => { setEditingBid(id); setEditBidValue(String(bid)); }}
                onBidChange={setEditBidValue}
                onBidSave={saveBid}
                onBidCancel={() => setEditingBid(null)}
                onStrategyToggle={(id) => setEditingStrategy(editingStrategy === id ? null : id)}
                onStrategyChange={changeStrategy}
              />
            </div>

            {/* 5-D: Bid History Panel */}
            <div className="card" style={{ marginTop: 24 }}>
              <div className="card-header"><h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Clock size={18} /> 입찰 변경 이력</h3></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>시간</th><th>키워드</th><th>변경 전</th><th>변경 후</th><th>변경자</th><th>사유</th></tr></thead>
                  <tbody>
                    {bidHistory.map((h, i) => (
                      <tr key={i}>
                        <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{h.time}</td>
                        <td style={{ fontWeight: 600 }}>{h.keyword}</td>
                        <td>₩{h.from.toLocaleString()}</td>
                        <td style={{ fontWeight: 600 }}>₩{h.to.toLocaleString()}</td>
                        <td><span className={`badge ${h.by === "AI" ? "badge-info" : "badge-success"}`}>{h.by}</span></td>
                        <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{h.reason}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {viewTab === "rank" && (
          <>
            {/* 5-E: Rank Trend Chart */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header"><h3>📈 순위 변동 추이 (PC)</h3></div>
              <div className="card-body">
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={rankTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis dataKey="date" stroke="var(--text-muted)" fontSize={12} />
                    <YAxis reversed domain={[1, 5]} stroke="var(--text-muted)" fontSize={12} unit="위" />
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} />
                    <Line type="monotone" dataKey="형사변호사" stroke="#1E40AF" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="임플란트가격" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="수학학원추천" stroke="#F59E0B" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="쌍꺼풀수술가격" stroke="#EF4444" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Rank Table */}
            <div className="card">
              <div className="card-header"><h3>📊 키워드별 순위 모니터링</h3></div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>키워드</th><th>PC 순위</th><th>모바일 순위</th><th>목표 순위</th><th>입찰가</th><th>트렌드</th><th>변동</th></tr></thead>
                  <tbody>
                    {keywords.slice(0, 6).map((kw) => (
                      <tr key={kw.id}>
                        <td style={{ fontWeight: 600 }}>{kw.text}</td>
                        <td><span className={`badge ${kw.rank <= 2 ? "badge-success" : "badge-warning"}`}>{kw.rank}위</span></td>
                        <td><span className={`badge ${kw.rank <= 3 ? "badge-success" : "badge-warning"}`}>-</span></td>
                        <td>{kw.strategy === "target_rank" ? `${kw.rank}위` : "-"}</td>
                        <td>₩{kw.bid.toLocaleString()}</td>
                        <td>{kw.trend === "up" ? <TrendingUp size={16} color="var(--success)" /> : <TrendingDown size={16} color="var(--error)" />}</td>
                        <td style={{ color: kw.trend === "up" ? "var(--success)" : "var(--error)" }}>{kw.trend === "up" ? "▲ 상승" : "▼ 하락"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {viewTab === "fraud" && (
          <>
            {/* Fraud Summary KPIs */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 24 }}>
              {[
                { label: "총 클릭", value: "48,230", sub: "최근 7일", color: "#1E40AF" },
                { label: "의심 클릭", value: "2,415 (5.0%)", sub: "탐지됨", color: "#F59E0B" },
                { label: "차단 IP", value: "180", sub: "활성 차단", color: "#EF4444" },
                { label: "절감액", value: "₩350,000", sub: "추정 절감", color: "#10B981" },
              ].map((kpi) => (
                <div key={kpi.label} className="card" style={{ padding: 20, textAlign: "center" }}>
                  <div style={{ fontSize: "0.786rem", color: "var(--text-muted)", marginBottom: 4 }}>{kpi.label}</div>
                  <div style={{ fontSize: "1.286rem", fontWeight: 700, color: kpi.color }}>{kpi.value}</div>
                  <div style={{ fontSize: "0.714rem", color: "var(--text-muted)" }}>{kpi.sub}</div>
                </div>
              ))}
            </div>

            {/* Suspicious Clicks Table */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header">
                <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Shield size={18} color="var(--warning)" /> 실시간 의심 클릭
                  <span className="badge badge-warning">{fraudEvents.filter((f: FraudEvent) => f.status === "pending").length}건 미확인</span>
                </h3>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead>
                    <tr><th style={{ width: 32 }}><input type="checkbox" /></th><th>시간</th><th>키워드</th><th>IP (마스킹)</th><th>위험도</th><th>상태</th></tr>
                  </thead>
                  <tbody>
                    {fraudEvents.map((fe: FraudEvent) => (
                      <tr key={fe.id} style={{ background: selectedFraud.has(fe.id) ? "var(--primary-light)" : undefined }}>
                        <td><input type="checkbox" checked={selectedFraud.has(fe.id)} onChange={() => toggleFraud(fe.id)} disabled={fe.status !== "pending"} /></td>
                        <td>{fe.time}</td>
                        <td style={{ fontWeight: 600 }}>{fe.keyword}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "0.857rem" }}>{fe.ip}</td>
                        <td>
                          <span className={`badge ${fe.risk === "high" ? "badge-error" : fe.risk === "medium" ? "badge-warning" : "badge-info"}`}>
                            {fe.risk === "high" ? "🔴 높음" : fe.risk === "medium" ? "🟡 보통" : "🔵 낮음"}
                          </span>
                        </td>
                        <td>
                          {fe.status === "pending" ? <span className="badge badge-warning">미확인</span> :
                           fe.status === "blocked" ? <span className="badge badge-error">차단됨</span> :
                           <span className="badge badge-success">정상 처리</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {selectedFraud.size > 0 && (
                <div style={{ padding: "12px 16px", borderTop: "1px solid var(--border)", display: "flex", gap: 8 }}>
                  <button className="btn btn-sm btn-primary" onClick={() => handleFraudAction("block")}><Shield size={14} /> 선택 IP 차단</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleFraudAction("refund")}>📋 환급 신청 준비</button>
                  <button className="btn btn-sm btn-secondary" onClick={() => handleFraudAction("normal")}><CheckCircle2 size={14} /> 정상 처리</button>
                </div>
              )}
            </div>

            {/* Blocked IP List */}
            <div className="card">
              <div className="card-header">
                <h3>🚫 차단 IP 목록 ({blockedIPs.length}건)</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => { downloadCsv("차단IP목록", ["IP", "차단일", "사유", "상태"], blockedIPs.map((ip) => [ip.ip, ip.blockedAt, ip.reason, ip.status])); addToast("success", "CSV 내보내기 완료"); }}>CSV 내보내기</button>
                </div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>IP (마스킹)</th><th>차단일</th><th>사유</th><th>상태</th><th></th></tr></thead>
                  <tbody>
                    {blockedIPs.map((ip, i) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "monospace" }}>{ip.ip}</td>
                        <td>{ip.blockedAt}</td>
                        <td style={{ fontSize: "0.857rem" }}>{ip.reason}</td>
                        <td>
                          {ip.status === "active" ? <span className="badge badge-error">차단 중</span> : <span className="badge badge-info">만료</span>}
                        </td>
                        <td>{ip.status === "active" && <button className="btn btn-ghost btn-sm" onClick={() => { setFraudEvents((prev) => prev.map((fe) => fe.ip === ip.ip ? { ...fe, status: "cleared" } : fe)); addToast("info", "IP 차단 해제", `${ip.ip} 차단이 해제되었습니다.`); }}>해제</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AI Keyword Recommendation Modal */}
      {showAiModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-modal)", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 600, width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={20} color="var(--primary)" /> AI 키워드 추천</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowAiModal(false); setAddedRecommendations(new Set()); }}><X size={18} /></button>
            </div>
            <p style={{ fontSize: "0.857rem", color: "var(--text-secondary)", marginBottom: 16 }}>기존 키워드 분석을 바탕으로 저비용 고효율 키워드를 추천합니다.</p>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>키워드</th><th>월 검색량</th><th>경쟁도</th><th>예상 CPC</th><th>예상 전환</th><th></th></tr></thead>
                <tbody>
                  {aiRecommendedKeywords.map((rk) => (
                    <tr key={rk.text}>
                      <td style={{ fontWeight: 600 }}>{rk.text}</td>
                      <td>{rk.searchVol.toLocaleString()}</td>
                      <td><span className={`badge ${rk.competition === "낮음" ? "badge-success" : "badge-warning"}`}>{rk.competition}</span></td>
                      <td>₩{rk.estCpc.toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{rk.estConv}건/월</td>
                      <td>
                        {addedRecommendations.has(rk.text) ? (
                          <span className="badge badge-success">✅ 추가됨</span>
                        ) : (
                          <button className="btn btn-sm btn-primary" onClick={() => {
                            const newId = Math.max(...keywords.map((k) => k.id)) + 1;
                            setKeywords((prev) => [...prev, {
                              id: newId, text: rk.text, group: "AI_추천", account: "A 법률사무소",
                              bid: rk.estCpc, rank: 0, strategy: "target_cpc", qi: 7,
                              impressions: 0, clicks: 0, ctr: 0, cpc: rk.estCpc,
                              conversions: 0, cost: 0, trend: "up",
                            }]);
                            setAddedRecommendations((prev) => new Set([...prev, rk.text]));
                            addToast("success", "키워드 추가됨", `'${rk.text}' 키워드가 추가되었습니다.`);
                          }}><Plus size={14} /> 추가</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setShowAiModal(false); setAddedRecommendations(new Set()); }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
