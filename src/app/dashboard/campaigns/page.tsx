"use client";

import { useState, useEffect, useMemo, Suspense, useCallback } from "react";
import {
  Plus, Search, Play, Pause, ChevronRight, ChevronDown,
  Square, FolderOpen, Folder, BarChart3, KeyRound, Megaphone,
  Package, RefreshCw, Clock,
} from "lucide-react";
import { useToast } from "@/components/Toast";
import { useSyncContext } from "@/components/SyncContext";
import { useAccounts, useCampaigns, useAdGroups, useKeywords, useAds, apiMutate, invalidateAll } from "@/hooks/useApi";
import { TableSkeleton } from "@/components/Skeleton";

// ── 타입 ──
type TreeNodeType = "root" | "account" | "campaign" | "adgroup";
type DetailTab = "keywords" | "ads";

interface TreeSelection {
  type: TreeNodeType;
  id: string | null;
  accountId?: string;
  accountName?: string;
  campaignName?: string;
  adGroupName?: string;
}

// ── 상태 매핑 ──
const mapStatus = (s: string) => {
  const lower = (s ?? "").toLowerCase();
  if (["eligible", "active", "enable"].includes(lower)) return "active";
  if (["paused", "pause"].includes(lower)) return "paused";
  return lower || "active";
};

const StatusBadge = ({ status }: { status: string }) => {
  if (status === "active") return <span className="badge badge-success"><Play size={10} /> 활성</span>;
  if (status === "paused") return <span className="badge badge-warning"><Pause size={10} /> 정지</span>;
  return <span className="badge badge-error"><Square size={10} /> 종료</span>;
};

const StatusDot = ({ status }: { status: string }) => (
  <span style={{
    width: 6, height: 6, borderRadius: "50%", flexShrink: 0,
    background: status === "active" ? "var(--success)" : status === "paused" ? "var(--warning)" : "var(--error)",
  }} />
);

// ── 시간 표시 헬퍼 ──
function timeAgo(dateStr?: string | null): string {
  if (!dateStr) return "동기화 기록 없음";
  const diff = Date.now() - new Date(dateStr).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "방금 전";
  if (min < 60) return `${min}분 전`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
}

// ══════════════════════════════════════════════════════════════
// 메인 컴포넌트
// ══════════════════════════════════════════════════════════════
function AdManagerContent() {
  const { addToast } = useToast();

  // ── API 데이터 ──
  const { data: apiAccounts, mutate: mutateAccounts } = useAccounts(1, 100);
  const { data: apiCampaigns, mutate: mutateCampaigns } = useCampaigns(1, 1000);
  const { data: apiAdGroups, mutate: mutateAdGroups } = useAdGroups(1, 1000);

  // ── 트리 상태 ──
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [selection, setSelection] = useState<TreeSelection>({ type: "root", id: null });
  const [treeSearch, setTreeSearch] = useState("");
  const [detailTab, setDetailTab] = useState<DetailTab>("keywords");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncingAdGroup, setSyncingAdGroup] = useState<string | null>(null);

  // ── 키워드 입찰 수정 ──
  const [editingBid, setEditingBid] = useState<number | null>(null);
  const [editBidValue, setEditBidValue] = useState("");

  // ── 정규화 ──
  const accounts = useMemo(() => {
    if (!apiAccounts) return [];
    return (Array.isArray(apiAccounts) ? apiAccounts : []).map((a: any) => ({
      id: a.id, name: a.customerName || a.name || "", loginId: a.loginId || "",
      lastSyncAt: a.lastSyncAt,
    }));
  }, [apiAccounts]);

  const campaigns = useMemo(() => {
    if (!apiCampaigns) return [];
    return (Array.isArray(apiCampaigns) ? apiCampaigns : []).map((c: any) => ({
      id: c.id, name: c.name || "", accountId: c.naverAccountId,
      accountName: c.naverAccount?.customerName || "",
      status: mapStatus(c.status), type: c.campaignType || "WEB_SITE",
      dailyBudget: Number(c.dailyBudget ?? 0),
      totalCost: Number(c.totalCost ?? 0),
      impressions: Number(c.impressions ?? 0), clicks: Number(c.clicks ?? 0),
      ctr: Number(c.ctr ?? 0), cpc: Number(c.cpc ?? 0),
      conversions: Number(c.conversions ?? 0), roas: Number(c.roas ?? 0),
      lastSyncAt: c.lastSyncAt,
    }));
  }, [apiCampaigns]);

  const adGroups = useMemo(() => {
    if (!apiAdGroups) return [];
    return (Array.isArray(apiAdGroups) ? apiAdGroups : []).map((ag: any) => ({
      id: ag.id, name: ag.name || "", campaignId: ag.campaignId,
      campaignName: ag.campaign?.name || "",
      status: ag.isActive === false ? "paused" : "active",
      defaultBid: Number(ag.defaultBid ?? 0),
      keywordCount: ag._count?.keywords ?? 0,
      adCount: ag._count?.ads ?? 0,
      impressions: Number(ag.impressions ?? 0), clicks: Number(ag.clicks ?? 0),
      ctr: Number(ag.ctr ?? 0), cost: Number(ag.cost ?? 0),
      conversions: Number(ag.conversions ?? 0),
    }));
  }, [apiAdGroups]);


  // ── 트리 구조 ──
  const treeData = useMemo(() => {
    const campsByAccount = new Map<string, typeof campaigns>();
    campaigns.forEach(c => {
      const key = c.accountName || "미지정";
      if (!campsByAccount.has(key)) campsByAccount.set(key, []);
      campsByAccount.get(key)!.push(c);
    });
    const agByCampaign = new Map<number, typeof adGroups>();
    adGroups.forEach(ag => {
      if (!agByCampaign.has(ag.campaignId)) agByCampaign.set(ag.campaignId, []);
      agByCampaign.get(ag.campaignId)!.push(ag);
    });
    const accountList = accounts.length > 0
      ? accounts
      : [...new Set(campaigns.map(c => c.accountName).filter(Boolean))].map(n => ({ id: "", name: n, loginId: "", lastSyncAt: null }));
    return accountList.map(acc => ({
      ...acc,
      campaigns: (campsByAccount.get(acc.name) || []).map(camp => ({
        ...camp,
        adGroups: agByCampaign.get(camp.id) || [],
      })),
    }));
  }, [accounts, campaigns, adGroups]);

  // ── 검색 필터 ──
  const filteredTreeData = useMemo(() => {
    if (!treeSearch.trim()) return treeData;
    const q = treeSearch.toLowerCase();
    return treeData.map(acc => ({
      ...acc,
      campaigns: acc.campaigns.filter(c =>
        c.name.toLowerCase().includes(q) ||
        c.adGroups.some(ag => ag.name.toLowerCase().includes(q))
      ).map(c => ({
        ...c,
        adGroups: c.adGroups.filter(ag => ag.name.toLowerCase().includes(q) || c.name.toLowerCase().includes(q)),
      })),
    })).filter(acc => acc.name.toLowerCase().includes(q) || acc.campaigns.length > 0);
  }, [treeData, treeSearch]);

  // ── 트리 조작 ──
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => { const s = new Set(prev); s.has(nodeId) ? s.delete(nodeId) : s.add(nodeId); return s; });
  }, []);

  const selectNode = useCallback((sel: TreeSelection) => {
    setSelection(sel);
    setSelectedRows(new Set());
    setSearchQuery("");
    if (sel.type === "adgroup") setDetailTab("keywords");
  }, []);

  // ── 동기화 (전체) ──
  const [syncProgress, setSyncProgress] = useState("");
  const globalSync = useSyncContext();
  const handleSyncAll = async () => {
    if (syncing) return;
    setSyncing(true);
    setSyncProgress("");
    globalSync.startSync("동기화 준비 중...");
    addToast("info", "동기화 시작", "네이버 광고 데이터를 동기화합니다...");
    try {
      let totalKw = 0, totalAds = 0;
      for (const acc of accounts) {
        if (!acc.id) continue;
        // Phase 1: 캠페인 + 광고그룹
        setSyncProgress("캠페인/광고그룹 구조 동기화 중...");
        globalSync.updateProgress("캠페인/광고그룹 구조 동기화 중...");
        const phase1: any = await apiMutate(`/api/accounts/${acc.id}/sync`, { method: "POST" });
        const pendingIds: string[] = phase1?.pendingAdGroupIds || [];

        // Phase 2: 소재 + 키워드 (3개씩 병렬)
        const BATCH = 3;
        for (let i = 0; i < pendingIds.length; i += BATCH) {
          const batch = pendingIds.slice(i, i + BATCH);
          const progressText = `키워드/소재 동기화 중... (${Math.min(i + BATCH, pendingIds.length)}/${pendingIds.length} 그룹)`;
          setSyncProgress(progressText);
          globalSync.updateProgress(progressText);
          const results = await Promise.allSettled(
            batch.map(agId =>
              apiMutate(`/api/accounts/${acc.id}/sync-adgroup`, {
                method: "POST",
                body: JSON.stringify({ adGroupId: agId }),
              })
            )
          );
          for (const r of results) {
            if (r.status === "fulfilled") {
              const v = r.value as any;
              totalKw += v?.synced?.keywords ?? 0;
              totalAds += v?.synced?.ads ?? 0;
            }
          }
          // 9개마다 광고그룹 카운트 갱신 (키워드 깜빡임 없이 트리 갱신)
          if ((i + BATCH) % 9 === 0) {
            mutateAdGroups();
          }
        }
      }
      // 최종 새로고침
      invalidateAll("/api/");
      mutateAccounts();
      mutateCampaigns();
      mutateAdGroups();
      mutateKeywords();
      addToast("success", "동기화 완료", `키워드 ${totalKw.toLocaleString()}개, 소재 ${totalAds.toLocaleString()}개 동기화됨`);
    } catch (err: any) {
      addToast("error", "동기화 실패", err?.message ?? "서버 오류");
    }
    setSyncing(false);
    setSyncProgress("");
    globalSync.endSync();
  };

  // ── 광고그룹 단일 동기화 ──
  const handleSyncAdGroup = async (agId: string) => {
    if (syncingAdGroup) return;
    // accountId 찾기: adGroup → campaign → naverAccountId
    const ag = adGroups.find(a => a.id === agId);
    const camp = campaigns.find(c => c.id === ag?.campaignId);
    const accountId = camp?.accountId;
    if (!accountId) { addToast("error", "동기화 불가", "계정 정보를 찾을 수 없습니다."); return; }
    setSyncingAdGroup(agId);
    try {
      await apiMutate(`/api/accounts/${accountId}/sync-adgroup`, {
        method: "POST",
        body: JSON.stringify({ adGroupId: agId }),
      });
      invalidateAll("/api/keywords");
      invalidateAll("/api/ads");
      invalidateAll("/api/ad-groups");
      mutateKeywords();
      mutateAdGroups();
      addToast("success", "동기화 완료", `"${ag?.name}" 키워드/소재가 업데이트되었습니다.`);
    } catch (err: any) {
      addToast("error", "동기화 실패", err?.message ?? "서버 오류");
    }
    setSyncingAdGroup(null);
  };

  // ── 우측 패널 데이터 ──
  const detailCampaigns = useMemo(() => {
    if (selection.type === "root") return campaigns;
    if (selection.type === "account") return campaigns.filter(c => c.accountName === selection.accountName);
    return [];
  }, [selection, campaigns]);
  const detailAdGroups = useMemo(() => {
    if (selection.type === "campaign") return adGroups.filter(ag => ag.campaignId === selection.id);
    return [];
  }, [selection, adGroups]);

  // 광고그룹 선택 시 서버에서 해당 그룹의 키워드/소재를 on-demand 로드
  const selectedAdGroupId = selection.type === "adgroup" ? selection.id : null;
  const { data: apiSelectedKeywords, mutate: mutateKeywords } = useKeywords(
    1, 1000, selectedAdGroupId ? { adGroupId: selectedAdGroupId } : undefined
  );
  const { data: apiSelectedAds } = useAds(
    1, 100, selectedAdGroupId ? { adGroupId: selectedAdGroupId } : undefined
  );
  const detailKeywords = useMemo(() => {
    if (!selectedAdGroupId || !apiSelectedKeywords) return [];
    return (Array.isArray(apiSelectedKeywords) ? apiSelectedKeywords : []).map((k: any) => ({
      id: k.id, text: k.keywordText || "", adGroupId: k.adGroupId,
      adGroupName: k.adGroup?.name || "",
      bid: Number(k.currentBid ?? 0), rank: k.targetRank ?? 0,
      strategy: k.bidStrategy || "manual", qi: k.qualityIndex ?? 0,
      impressions: Number(k.impressions ?? 0), clicks: Number(k.clicks ?? 0),
      ctr: Number(k.ctr ?? 0) * 100, cpc: Number(k.cpc ?? 0),
      conversions: Number(k.conversions ?? 0), cost: Number(k.cost ?? 0),
      lastSyncAt: k.lastSyncAt,
    }));
  }, [selectedAdGroupId, apiSelectedKeywords]);
  const detailAds = useMemo(() => {
    if (selection.type !== "adgroup" || !apiSelectedAds) return [];
    return (Array.isArray(apiSelectedAds) ? apiSelectedAds : []).map((a: any) => ({
      id: a.id, title: a.title || "", description: a.description || "",
      adGroupId: a.adGroupId, adGroupName: a.adGroup?.name || "",
      displayUrl: a.displayUrl || "", landingUrl: a.landingUrl || "",
      isActive: a.isActive !== false,
      status: (a.isActive !== false ? "active" : "paused"),
      impressions: Number(a.impressions ?? 0), clicks: Number(a.clicks ?? 0),
      ctr: Number(a.ctr ?? 0), conversions: Number(a.conversions ?? 0),
      cost: Number(a.cost ?? 0),
    }));
  }, [selection, apiSelectedAds]);

  const applySearch = useCallback(<T extends Record<string, any>>(items: T[], ...fields: string[]) => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter(item => fields.some(f => String(item[f] || "").toLowerCase().includes(q)));
  }, [searchQuery]);

  const breadcrumbPath = useMemo(() => {
    const parts: { label: string; onClick?: () => void }[] = [
      { label: "전체", onClick: () => selectNode({ type: "root", id: null }) },
    ];
    if (selection.accountName) parts.push({ label: selection.accountName, onClick: () => selectNode({ type: "account", id: null, accountId: selection.accountId, accountName: selection.accountName }) });
    if (selection.campaignName) parts.push({ label: selection.campaignName, onClick: () => selectNode({ type: "campaign", id: selection.id, accountId: selection.accountId, accountName: selection.accountName, campaignName: selection.campaignName }) });
    if (selection.adGroupName) parts.push({ label: selection.adGroupName });
    return parts;
  }, [selection, selectNode]);

  const toggleRow = (id: string) => setSelectedRows(prev => { const s = new Set(prev); s.has(id as any) ? s.delete(id as any) : s.add(id as any); return s; });

  const saveBid = async (id: string) => {
    const newBid = parseInt(editBidValue);
    if (isNaN(newBid) || newBid <= 0) { setEditingBid(null); return; }
    const kw = detailKeywords.find((k: any) => k.id === id);
    try {
      await apiMutate(`/api/keywords/${id}`, { method: "PUT", body: JSON.stringify({ newBid, reason: "수동 변경" }) });
      addToast("success", "입찰가 변경", `'${kw?.text}' → ₩${newBid.toLocaleString()}`);
    } catch (err: any) { addToast("error", "변경 실패", err?.message ?? ""); }
    setEditingBid(null);
  };

  // 마지막 동기화 시간
  const lastSyncTime = useMemo(() => {
    const times = accounts.map(a => a.lastSyncAt).filter(Boolean);
    if (times.length === 0) return null;
    return times.sort((a: string, b: string) => new Date(b).getTime() - new Date(a).getTime())[0];
  }, [accounts]);

  // ── 트리 노드 렌더러 ──
  const renderTreeNode = (
    label: string, nodeId: string, icon: React.ReactNode, level: number,
    hasChildren: boolean, isSelected: boolean, onClick: () => void,
    count?: number, status?: string,
  ) => {
    const isExpanded = expandedNodes.has(nodeId);
    return (
      <div key={nodeId}
        onClick={(e) => { e.stopPropagation(); if (hasChildren) toggleNode(nodeId); onClick(); }}
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "7px 10px", paddingLeft: 12 + level * 18,
          borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.857rem",
          fontWeight: isSelected ? 600 : 400,
          background: isSelected ? "var(--primary-light)" : undefined,
          color: isSelected ? "var(--primary)" : "var(--text-primary)",
          transition: "all 0.15s", marginBottom: 1,
        }}
        onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = "var(--surface-hover)"; }}
        onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = ""; }}
      >
        {hasChildren ? (isExpanded ? <ChevronDown size={14} style={{ flexShrink: 0 }} /> : <ChevronRight size={14} style={{ flexShrink: 0 }} />) : <span style={{ width: 14, flexShrink: 0 }} />}
        {status && <StatusDot status={status} />}
        {icon}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{label}</span>
        {count !== undefined && <span style={{ fontSize: "0.714rem", color: "var(--text-muted)", flexShrink: 0 }}>({count})</span>}
      </div>
    );
  };

  const strategyLabels: Record<string, string> = {
    target_rank: "목표순위", target_cpc: "목표CPC", target_roas: "목표ROAS",
    max_conversion: "최대전환", time_based: "시간차등", manual: "수동",
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">광고 관리</h1>
        <div className="main-header-actions" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* 마지막 동기화 시간 */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.786rem", color: "var(--text-muted)" }}>
            <Clock size={13} />
            <span>{lastSyncTime ? `최근 동기화: ${timeAgo(lastSyncTime)}` : "동기화 기록 없음"}</span>
          </div>
          {/* 동기화 버튼 */}
          <button className="btn btn-secondary" onClick={handleSyncAll} disabled={syncing}
            style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <RefreshCw size={15} className={syncing ? "spin" : ""} style={syncing ? { animation: "spin 1s linear infinite" } : {}} />
            {syncing ? (syncProgress || "동기화 중...") : "재동기화"}
          </button>
        </div>
      </header>

      {/* ════ 동기화 진행 배너 ════ */}
      {syncing && (
        <div style={{
          background: "linear-gradient(135deg, #2563eb, #3b82f6)",
          color: "#fff",
          padding: "10px 24px",
          display: "flex",
          alignItems: "center",
          gap: 12,
          fontSize: "0.85rem",
          fontWeight: 500,
          boxShadow: "0 2px 8px rgba(37,99,235,0.3)",
        }}>
          <RefreshCw size={16} style={{ animation: "spin 1s linear infinite", flexShrink: 0 }} />
          <span style={{ flex: 1 }}>
            {syncProgress || "동기화 준비 중..."}
          </span>
          <span style={{
            background: "rgba(255,255,255,0.2)",
            borderRadius: 12,
            padding: "2px 12px",
            fontSize: "0.75rem",
          }}>
            진행 중
          </span>
        </div>
      )}

      <div style={{ padding: 0, background: "var(--surface)" }}>
        <div style={{ display: "flex", gap: 0, minHeight: "calc(100vh - 64px)" }}>

          {/* ════ 좌측 트리 ════ */}
          <div style={{
            width: 280, flexShrink: 0, borderRight: "1px solid var(--border)",
            background: "var(--bg-card, var(--surface))",
            display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ padding: "16px 14px 8px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>광고 구조</div>
              <div style={{ position: "relative" }}>
                <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: 8 }} />
                <input className="form-input" placeholder="검색..." value={treeSearch} onChange={e => setTreeSearch(e.target.value)} style={{ paddingLeft: 28, fontSize: "0.786rem", height: 30 }} />
              </div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "8px 6px" }}>
              {renderTreeNode(`전체 (${campaigns.length}개 캠페인)`, "root", <FolderOpen size={14} color="var(--primary)" />, 0, false, selection.type === "root", () => selectNode({ type: "root", id: null }))}
              {filteredTreeData.map(acc => (
                <div key={acc.name}>
                  {renderTreeNode(acc.name || "미지정", `acc-${acc.name}`, expandedNodes.has(`acc-${acc.name}`) ? <FolderOpen size={14} color="var(--warning)" /> : <Folder size={14} color="var(--warning)" />, 0, true, selection.type === "account" && selection.accountName === acc.name, () => selectNode({ type: "account", id: null, accountId: acc.id, accountName: acc.name }), acc.campaigns.length)}
                  {expandedNodes.has(`acc-${acc.name}`) && acc.campaigns.map(camp => (
                    <div key={camp.id}>
                      {renderTreeNode(camp.name, `camp-${camp.id}`, <BarChart3 size={13} color="var(--info)" />, 1, true, selection.type === "campaign" && selection.id === String(camp.id), () => selectNode({ type: "campaign", id: String(camp.id), accountId: acc.id, accountName: acc.name, campaignName: camp.name }), camp.adGroups.length, camp.status)}
                      {expandedNodes.has(`camp-${camp.id}`) && camp.adGroups.map(ag => (
                        <div key={ag.id}>
                          {renderTreeNode(ag.name, `ag-${ag.id}`, <Package size={13} color="var(--text-secondary)" />, 2, false, selection.type === "adgroup" && selection.id === String(ag.id), () => selectNode({ type: "adgroup", id: String(ag.id), accountId: acc.id, accountName: acc.name, campaignName: camp.name, adGroupName: ag.name }), ag.keywordCount, ag.status)}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              {filteredTreeData.length === 0 && <div style={{ textAlign: "center", padding: "40px 16px", color: "var(--text-muted)", fontSize: "0.857rem" }}>{treeSearch ? "검색 결과 없음" : "데이터 없음"}</div>}
            </div>
            <div style={{ padding: "10px 14px", borderTop: "1px solid var(--border)", fontSize: "0.714rem", color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
              <span>계정 {filteredTreeData.length}</span><span>캠페인 {campaigns.length}</span><span>그룹 {adGroups.length}</span>
            </div>
          </div>

          {/* ════ 우측 상세 ════ */}
          <div style={{ flex: 1, minWidth: 0, background: "var(--bg-card, var(--surface))", display: "flex", flexDirection: "column" }}>
            {/* Breadcrumb */}
            <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", gap: 6, fontSize: "0.857rem" }}>
              {breadcrumbPath.map((part, i) => (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {i > 0 && <ChevronRight size={12} color="var(--text-muted)" />}
                  {part.onClick ? (
                    <span onClick={part.onClick} style={{ cursor: "pointer", color: "var(--primary)", fontWeight: 500 }}
                      onMouseEnter={e => e.currentTarget.style.textDecoration = "underline"}
                      onMouseLeave={e => e.currentTarget.style.textDecoration = ""}>{part.label}</span>
                  ) : <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{part.label}</span>}
                </span>
              ))}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "16px 20px" }}>

              {/* ── 캠페인 목록 ── */}
              {(selection.type === "root" || selection.type === "account") && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>
                      {selection.type === "root" ? "전체 캠페인" : `${selection.accountName} 캠페인`}
                      <span style={{ fontWeight: 400, color: "var(--text-muted)", marginLeft: 8, fontSize: "0.857rem" }}>({detailCampaigns.length})</span>
                    </h3>
                    <div style={{ position: "relative" }}>
                      <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: 8 }} />
                      <input className="form-input" placeholder="검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 28, width: 200, fontSize: "0.857rem", height: 32 }} />
                    </div>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th style={{ width: 32 }}><input type="checkbox" /></th><th>캠페인</th>{selection.type === "root" && <th>계정</th>}<th>상태</th><th>일예산</th><th>지출</th><th>클릭</th><th>전환</th><th>ROAS</th></tr></thead>
                      <tbody>
                        {applySearch(detailCampaigns, "name", "accountName").map(c => (
                          <tr key={c.id} style={{ cursor: "pointer", background: selectedRows.has(c.id) ? "var(--primary-light)" : undefined }}
                            onClick={() => { toggleNode(`acc-${c.accountName}`); toggleNode(`camp-${c.id}`); selectNode({ type: "campaign", id: String(c.id), accountName: c.accountName, campaignName: c.name }); }}>
                            <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedRows.has(c.id)} onChange={() => toggleRow(c.id)} /></td>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            {selection.type === "root" && <td style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{c.accountName}</td>}
                            <td><StatusBadge status={c.status} /></td>
                            <td>₩{c.dailyBudget.toLocaleString()}</td>
                            <td style={{ fontWeight: 600 }}>₩{c.totalCost.toLocaleString()}</td>
                            <td>{c.clicks.toLocaleString()}</td>
                            <td style={{ fontWeight: 600 }}>{c.conversions}</td>
                            <td style={{ fontWeight: 700, color: c.roas > 300 ? "var(--success)" : c.roas > 200 ? "var(--warning)" : c.roas > 0 ? "var(--error)" : "var(--text-muted)" }}>{c.roas > 0 ? `${c.roas.toFixed(0)}%` : "-"}</td>
                          </tr>
                        ))}
                        {detailCampaigns.length === 0 && <tr><td colSpan={9} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>캠페인이 없습니다.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── 광고그룹 목록 ── */}
              {selection.type === "campaign" && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                    <h3 style={{ fontSize: "1rem", fontWeight: 700 }}>광고그룹 <span style={{ fontWeight: 400, color: "var(--text-muted)", fontSize: "0.857rem" }}>({detailAdGroups.length})</span></h3>
                    <div style={{ position: "relative" }}>
                      <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: 8 }} />
                      <input className="form-input" placeholder="검색..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 28, width: 200, fontSize: "0.857rem", height: 32 }} />
                    </div>
                  </div>
                  <div className="table-wrapper">
                    <table>
                      <thead><tr><th style={{ width: 32 }}><input type="checkbox" /></th><th>광고그룹</th><th>상태</th><th>기본입찰가</th><th>키워드</th><th>소재</th><th>노출</th><th>클릭</th><th>비용</th><th>전환</th></tr></thead>
                      <tbody>
                        {applySearch(detailAdGroups, "name").map(ag => (
                          <tr key={ag.id} style={{ cursor: "pointer", background: selectedRows.has(ag.id) ? "var(--primary-light)" : undefined }}
                            onClick={() => selectNode({ type: "adgroup", id: String(ag.id), accountId: selection.accountId, accountName: selection.accountName, campaignName: selection.campaignName, adGroupName: ag.name })}>
                            <td onClick={e => e.stopPropagation()}><input type="checkbox" checked={selectedRows.has(ag.id)} onChange={() => toggleRow(ag.id)} /></td>
                            <td style={{ fontWeight: 600 }}>{ag.name}</td>
                            <td><StatusBadge status={ag.status} /></td>
                            <td style={{ fontWeight: 600 }}>₩{ag.defaultBid.toLocaleString()}</td>
                            <td><span style={{ color: "var(--primary)", fontWeight: 600 }}>{ag.keywordCount}</span></td>
                            <td><span style={{ color: "var(--info)", fontWeight: 600 }}>{ag.adCount}</span></td>
                            <td>{ag.impressions.toLocaleString()}</td>
                            <td>{ag.clicks.toLocaleString()}</td>
                            <td style={{ fontWeight: 600 }}>₩{ag.cost.toLocaleString()}</td>
                            <td style={{ fontWeight: 600 }}>{ag.conversions}</td>
                          </tr>
                        ))}
                        {detailAdGroups.length === 0 && <tr><td colSpan={10} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}>광고그룹이 없습니다.</td></tr>}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* ── 광고그룹 상세: 키워드/소재 탭 ── */}
              {selection.type === "adgroup" && (
                <>
                  {/* 탭 + 동기화 버튼 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 0 }}>
                    <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--border)", flex: 1 }}>
                      {(["keywords", "ads"] as DetailTab[]).map(tab => (
                        <button key={tab} onClick={() => { setDetailTab(tab); setSelectedRows(new Set()); }}
                          style={{
                            padding: "10px 20px", fontSize: "0.929rem", fontWeight: detailTab === tab ? 700 : 400,
                            color: detailTab === tab ? "var(--primary)" : "var(--text-secondary)",
                            background: "none", border: "none", borderBottom: detailTab === tab ? "2px solid var(--primary)" : "2px solid transparent",
                            marginBottom: -2, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, transition: "all 0.2s",
                          }}>
                          {tab === "keywords" ? <><KeyRound size={15} /> 키워드 <span style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>({detailKeywords.length})</span></> : <><Megaphone size={15} /> 소재 <span style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>({detailAds.length})</span></>}
                        </button>
                      ))}
                    </div>
                    <button className="btn btn-sm btn-secondary" onClick={() => handleSyncAdGroup(selection.id!)} disabled={!!syncingAdGroup}
                      style={{ marginLeft: 12, display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                      <RefreshCw size={13} style={syncingAdGroup === selection.id ? { animation: "spin 1s linear infinite" } : {}} />
                      {syncingAdGroup === selection.id ? "동기화 중..." : "이 그룹 동기화"}
                    </button>
                  </div>

                  {/* 검색 + 일괄액션 */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0" }}>
                    <div style={{ position: "relative" }}>
                      <Search size={14} color="var(--text-muted)" style={{ position: "absolute", left: 8, top: 8 }} />
                      <input className="form-input" placeholder={`${detailTab === "keywords" ? "키워드" : "소재"} 검색...`} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} style={{ paddingLeft: 28, width: 240, fontSize: "0.857rem", height: 32 }} />
                    </div>
                    {selectedRows.size > 0 && detailTab === "keywords" && (
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: "0.857rem", color: "var(--primary)", fontWeight: 600 }}>{selectedRows.size}개 선택:</span>
                        <button className="btn btn-sm btn-secondary" onClick={() => { addToast("success", "+100원", `${selectedRows.size}개 적용`); setSelectedRows(new Set()); }}>+100원</button>
                        <button className="btn btn-sm btn-secondary" onClick={() => { addToast("success", "-100원", `${selectedRows.size}개 적용`); setSelectedRows(new Set()); }}>-100원</button>
                      </div>
                    )}
                  </div>

                  {/* 키워드 탭 */}
                  {detailTab === "keywords" && (
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th style={{ width: 32 }}><input type="checkbox" onChange={() => setSelectedRows(prev => prev.size === detailKeywords.length ? new Set() : new Set(detailKeywords.map(k => k.id)))} /></th><th>키워드</th><th>입찰가</th><th>전략</th><th>품질</th><th>노출</th><th>클릭</th><th>CTR</th><th>CPC</th><th>전환</th><th>비용</th></tr></thead>
                        <tbody>
                          {applySearch(detailKeywords, "text").map(kw => (
                            <tr key={kw.id} style={{ background: selectedRows.has(kw.id) ? "var(--primary-light)" : undefined }}>
                              <td><input type="checkbox" checked={selectedRows.has(kw.id)} onChange={() => toggleRow(kw.id)} /></td>
                              <td style={{ fontWeight: 600 }}>{kw.text}</td>
                              <td style={{ fontWeight: 600 }}>
                                {editingBid === kw.id ? (
                                  <div style={{ display: "flex", gap: 4 }}>
                                    <input className="form-input" type="number" value={editBidValue} onChange={e => setEditBidValue(e.target.value)} style={{ width: 80, height: 26, fontSize: "0.857rem" }} onKeyDown={e => { if (e.key === "Enter") saveBid(kw.id); if (e.key === "Escape") setEditingBid(null); }} autoFocus />
                                    <button className="btn btn-sm btn-primary" style={{ height: 26, padding: "0 8px" }} onClick={() => saveBid(kw.id)}>✓</button>
                                  </div>
                                ) : (
                                  <span style={{ cursor: "pointer", borderBottom: "1px dashed var(--border)" }} onClick={() => { setEditingBid(kw.id); setEditBidValue(String(kw.bid)); }}>₩{kw.bid.toLocaleString()}</span>
                                )}
                              </td>
                              <td><span className="badge badge-info" style={{ fontSize: "0.714rem" }}>{strategyLabels[kw.strategy] || kw.strategy}</span></td>
                              <td><span style={{ fontWeight: 700, color: kw.qi >= 7 ? "var(--success)" : kw.qi >= 4 ? "var(--warning)" : "var(--error)" }}>{kw.qi || "-"}</span></td>
                              <td>{kw.impressions.toLocaleString()}</td>
                              <td>{kw.clicks.toLocaleString()}</td>
                              <td style={{ fontWeight: 600 }}>{kw.ctr.toFixed(1)}%</td>
                              <td>₩{kw.cpc.toLocaleString()}</td>
                              <td style={{ fontWeight: 600 }}>{kw.conversions}</td>
                              <td>₩{kw.cost.toLocaleString()}</td>
                            </tr>
                          ))}
                          {detailKeywords.length === 0 && <tr><td colSpan={11} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}><KeyRound size={32} color="var(--border)" style={{ display: "block", margin: "0 auto 12px" }} />등록된 키워드가 없습니다. 위 "이 그룹 동기화" 버튼을 눌러 데이터를 가져오세요.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* 소재 탭 */}
                  {detailTab === "ads" && (
                    <div className="table-wrapper">
                      <table>
                        <thead><tr><th style={{ width: 32 }}><input type="checkbox" /></th><th style={{ width: "30%" }}>소재</th><th>상태</th><th>노출</th><th>클릭</th><th>CTR</th><th>전환</th><th>비용</th></tr></thead>
                        <tbody>
                          {applySearch(detailAds, "title", "description").map(ad => (
                            <tr key={ad.id} style={{ background: selectedRows.has(ad.id) ? "var(--primary-light)" : undefined }}>
                              <td><input type="checkbox" checked={selectedRows.has(ad.id)} onChange={() => toggleRow(ad.id)} /></td>
                              <td><div style={{ fontWeight: 600, marginBottom: 3 }}>{ad.title}</div><div style={{ fontSize: "0.786rem", color: "var(--text-secondary)" }}>{ad.description}</div></td>
                              <td><StatusBadge status={ad.status} /></td>
                              <td>{ad.impressions.toLocaleString()}</td>
                              <td>{ad.clicks.toLocaleString()}</td>
                              <td style={{ fontWeight: 600 }}>{(ad.ctr * 100).toFixed(2)}%</td>
                              <td style={{ fontWeight: 600 }}>{ad.conversions}</td>
                              <td>₩{ad.cost.toLocaleString()}</td>
                            </tr>
                          ))}
                          {detailAds.length === 0 && <tr><td colSpan={8} style={{ textAlign: "center", padding: 40, color: "var(--text-muted)" }}><Megaphone size={32} color="var(--border)" style={{ display: "block", margin: "0 auto 12px" }} />등록된 소재가 없습니다. 위 "이 그룹 동기화" 버튼을 눌러 데이터를 가져오세요.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 스핀 애니메이션 */}
      <style jsx>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="main-body"><TableSkeleton /></div>}>
      <AdManagerContent />
    </Suspense>
  );
}
