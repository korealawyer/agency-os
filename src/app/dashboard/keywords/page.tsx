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

type KeywordItem = { id: number; text: string; group: string; campaign: string; account: string; bid: number; rank: number; strategy: string; qi: number; impressions: number; clicks: number; ctr: number; cpc: number; conversions: number; cost: number; trend: string };

type BidRecommendation = {
  keywordId: string;
  keyword: string;
  campaign: string;
  adGroup: string;
  currentBid: number;
  suggestedBid: number;
  action: 'decrease' | 'increase' | 'pause' | 'hold';
  reason: string;
  urgency: 'high' | 'medium' | 'low';
  metrics: { cost: string; clicks: number; conversions: number; ctrPct: string; estimatedRoas: string };
};


const aiRecommendedKeywords = [
  { text: "교통사고변호사", searchVol: 8200, competition: "낮음", estCpc: 680, estConv: 6 },
  { text: "상속변호사", searchVol: 5400, competition: "보통", estCpc: 850, estConv: 4 },
  { text: "임플란트비용", searchVol: 12100, competition: "낮음", estCpc: 520, estConv: 9 },
  { text: "치아교정가격", searchVol: 9800, competition: "보통", estCpc: 620, estConv: 7 },
  { text: "중학수학학원", searchVol: 6300, competition: "낮음", estCpc: 380, estConv: 11 },
];

type FraudEvent = { id: number; time: string; keyword: string; ip: string; risk: string; status: string };

// 입찰 변경 이력, 순위 트렌드, 차단 IP는 API에서 가져오거나 신규 계정은 비어있음

const bidHistory: { time: string; keyword: string; from: number; to: number; by: string; reason: string }[] = [];

const rankTrendData: any[] = [];

const strategyLabels: Record<string, string> = {
  target_rank: "목표 순위", target_cpc: "목표 CPC", target_roas: "목표 ROAS",
  max_conversion: "최대 전환", time_based: "시간대 차등", manual: "수동",
};

type SortDir = "asc" | "desc";

const allColumns = [
  { key: "text", label: "키워드", default: true },
  { key: "account", label: "계정", default: true },
  { key: "campaign", label: "캠페인", default: true },
  { key: "group", label: "광고그룹", default: true },
  { key: "bid", label: "입찰가", default: true },
  { key: "rank", label: "순위", default: true },
  { key: "strategy", label: "전략", default: true },
  { key: "qi", label: "품질", default: false },
  { key: "impressions", label: "노출", default: true },
  { key: "clicks", label: "클릭", default: true },
  { key: "ctr", label: "CTR", default: true },
  { key: "cpc", label: "CPC", default: true },
  { key: "conversions", label: "전환", default: true },
  { key: "cost", label: "비용", default: true },
];

export default function KeywordsPage() {
  const [viewTab, setViewTab] = useState<ViewTab>("keywords");
  const [selectedKws, setSelectedKws] = useState<Set<number>>(new Set());
  const [selectedFraud, setSelectedFraud] = useState<Set<number>>(new Set());
  const [editingBid, setEditingBid] = useState<number | null>(null);
  const [editBidValue, setEditBidValue] = useState("");
  const [keywords, setKeywords] = useState<KeywordItem[]>([]);
  const [showAiModal, setShowAiModal] = useState(false);
  const [addedRecommendations, setAddedRecommendations] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [accountFilter, setAccountFilter] = useState("전체 계정");
  const [strategyFilter, setStrategyFilter] = useState("전체 전략");
  const [fraudEvents, setFraudEvents] = useState<FraudEvent[]>([]);
  const [isBulkLoading, setIsBulkLoading] = useState(false);
  const [aiRecs, setAiRecs] = useState<BidRecommendation[]>([]);
  const [aiRecsLoading, setAiRecsLoading] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const { addToast } = useToast();

  // ── API 데이터 페칭 (폴백 지원) ──
  const { data: apiKeywords, isLoading: kwLoading } = useKeywords(1, 100);
  const { data: apiFraudEvents } = useClickFraudEvents();
  const { data: apiBlockedIps } = useBlockedIps();
  const { data: accountsData } = useAccounts(1, 100);
  const dynamicAccounts = ["전체 계정", ...(accountsData?.map((a: any) => a.customerName || a.name).filter(Boolean) ?? [])];

  // API 데이터가 있으면 로컬 상태 갱신
  useEffect(() => {
    if (apiKeywords !== undefined) {
      setKeywords(apiKeywords.map((k: any, i: number) => ({
        id: k.id ?? i + 1,
        text: k.keywordText ?? '',
        group: k.adGroup?.name ?? '',
        campaign: k.adGroup?.campaign?.name ?? '',
        account: k.adGroup?.campaign?.naverAccount?.customerName ?? '',
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

  // API 부정클릭 이벤트 데이터 반영
  useEffect(() => {
    if (apiFraudEvents !== undefined) {
      setFraudEvents(Array.isArray(apiFraudEvents) ? apiFraudEvents.map((e: any, i: number) => ({
        id: e.id ?? i + 1,
        time: e.detectedAt ? new Date(e.detectedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' }) : '-',
        keyword: e.keyword?.keywordText ?? e.keyword ?? '',
        ip: e.ipAddress ?? '',
        risk: e.riskScore >= 0.8 ? 'high' : e.riskScore >= 0.5 ? 'medium' : 'low',
        status: e.status ?? 'pending',
      })) : []);
    }
  }, [apiFraudEvents]);

  // AI 입찰 추천 — 모달 오픈 시 실 API 호출
  useEffect(() => {
    if (!showAiModal) return;
    setAiRecsLoading(true);
    setAiRecs([]);
    setAiSummary(null);
    fetch('/api/copilot/bid-recommendations')
      .then(r => r.json())
      .then(json => {
        setAiRecs(json.data?.recommendations ?? []);
        setAiSummary(json.data?.aiSummary ?? null);
      })
      .catch(() => {})
      .finally(() => setAiRecsLoading(false));
  }, [showAiModal]);

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
            <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
              <div style={{ position: "relative", flex: 1 }}>
                <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: 10 }} />
                <input className="form-input" placeholder="키워드 검색..." style={{ paddingLeft: 32 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
              </div>
              <select className="form-input" style={{ width: 180 }} value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
              {dynamicAccounts.map(opt => <option key={opt}>{opt}</option>)}
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
                <h3>🚫 차단 IP 목록 ({(apiBlockedIps ?? []).length}건)</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn btn-sm btn-secondary" onClick={() => { downloadCsv("차단IP목록", ["IP", "차단일", "사유", "상태"], (apiBlockedIps ?? []).map((ip: any) => [ip.ipAddress ?? ip.ip ?? '', ip.blockedAt ?? '', ip.reason ?? '', ip.isActive ? 'active' : 'expired'])); addToast("success", "CSV 내보내기 완료"); }}>CSV 내보내기</button>
                </div>
              </div>
              <div className="table-wrapper">
                <table>
                  <thead><tr><th>IP (마스킹)</th><th>차단일</th><th>사유</th><th>상태</th><th></th></tr></thead>
                  <tbody>
                    {(apiBlockedIps ?? []).length === 0 ? (
                      <tr><td colSpan={5} style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)" }}>차단된 IP가 없습니다.</td></tr>
                    ) : (apiBlockedIps ?? []).map((ip: any, i: number) => (
                      <tr key={i}>
                        <td style={{ fontFamily: "monospace" }}>{ip.ipAddress ?? ip.ip ?? ''}</td>
                        <td>{ip.blockedAt ? new Date(ip.blockedAt).toLocaleDateString('ko-KR') : '-'}</td>
                        <td style={{ fontSize: "0.857rem" }}>{ip.reason ?? ''}</td>
                        <td>
                          {ip.isActive !== false ? <span className="badge badge-error">차단 중</span> : <span className="badge badge-info">만료</span>}
                        </td>
                        <td>{ip.isActive !== false && <button className="btn btn-ghost btn-sm" onClick={() => { addToast("info", "IP 차단 해제", `${ip.ipAddress ?? ip.ip} 차단이 해제되었습니다.`); }}>해제</button>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>

      {/* AI 입찰 최적화 추천 Modal */}
      {showAiModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-modal)", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 720, width: "100%", boxShadow: "var(--shadow-xl)", maxHeight: "85vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Sparkles size={20} color="var(--primary)" /> AI 입찰 최적화 추천</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowAiModal(false); setAddedRecommendations(new Set()); setAiRecs([]); setAiSummary(null); }}><X size={18} /></button>
            </div>
            {aiSummary && (
              <div style={{ background: "var(--primary-light)", border: "1px solid var(--primary)", borderRadius: "var(--radius-lg)", padding: "12px 16px", marginBottom: 16, fontSize: "0.886rem", lineHeight: 1.6 }}>
                🤖 {aiSummary}
              </div>
            )}
            <p style={{ fontSize: "0.857rem", color: "var(--text-secondary)", marginBottom: 16 }}>실제 DB 키워드 성과(ROAS/CTR/전환)를 분석한 AI 입찰가 조정 추천입니다.</p>
            <div className="table-wrapper">
              <table>
                <thead><tr><th>키워드</th><th>예상 ROAS</th><th>CTR</th><th>현재 입찰</th><th>제안 입찰</th><th>사유</th><th></th></tr></thead>
                <tbody>
                  {aiRecsLoading ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>🤖 AI 분석 중...</td></tr>
                  ) : aiRecs.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px 0", color: "var(--text-muted)" }}>성과 데이터가 있는 키워드가 없습니다. 먼저 계정을 동기화해주세요.</td></tr>
                  ) : aiRecs.map((rec) => {
                    const urgencyColor = rec.urgency === "high" ? "var(--error)" : rec.urgency === "medium" ? "var(--warning)" : "var(--success)";
                    const bidDiff = rec.suggestedBid - rec.currentBid;
                    return (
                      <tr key={rec.keywordId}>
                        <td style={{ fontWeight: 600 }}>
                          <span style={{ display: "block" }}>{rec.keyword}</span>
                          <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>{rec.campaign}</span>
                        </td>
                        <td><span style={{ color: Number(rec.metrics.estimatedRoas) >= 300 ? "var(--success)" : "var(--error)" }}>{rec.metrics.estimatedRoas}%</span></td>
                        <td>{rec.metrics.ctrPct}%</td>
                        <td>₩{rec.currentBid.toLocaleString()}</td>
                        <td>
                          <span style={{ fontWeight: 600, color: bidDiff < 0 ? "var(--success)" : bidDiff > 0 ? "var(--warning)" : "var(--text-primary)" }}>
                            ₩{rec.suggestedBid.toLocaleString()}
                          </span>
                          <span style={{ fontSize: "0.75rem", marginLeft: 4, color: "var(--text-muted)" }}>({bidDiff > 0 ? "+" : ""}{bidDiff})</span>
                        </td>
                        <td style={{ fontSize: "0.786rem", color: "var(--text-secondary)", maxWidth: 180 }}>
                          <span style={{ display: "inline-block", width: 8, height: 8, borderRadius: "50%", background: urgencyColor, marginRight: 4 }} />
                          {rec.reason}
                        </td>
                        <td>
                          {addedRecommendations.has(rec.keyword) ? (
                            <span className="badge badge-success">✅ 적용</span>
                          ) : (
                            <button className="btn btn-sm btn-primary" onClick={() => {
                              setAddedRecommendations(prev => new Set([...prev, rec.keyword]));
                              addToast("info", "입찰가 조정 검토", `'${rec.keyword}' ₩${rec.suggestedBid.toLocaleString()} 입찰가 조정 요청이 접수되었습니다.`);
                            }}>적용</button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16, gap: 8 }}>
              <button className="btn btn-secondary" onClick={() => { setShowAiModal(false); setAddedRecommendations(new Set()); setAiRecs([]); setAiSummary(null); }}>닫기</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
