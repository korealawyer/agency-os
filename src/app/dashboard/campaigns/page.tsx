"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Plus, Search, Filter, Play, Pause, BarChart3, Package, ChevronRight, ChevronDown, ChevronUp, Square, X, Calendar } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { useToast } from "@/components/Toast";
import { useCampaigns, useAdGroups } from "@/hooks/useApi";
import { TableSkeleton } from "@/components/Skeleton";

const periods = ["오늘", "어제", "7일", "30일", "커스텀"] as const;

type ViewTab = "campaigns" | "adgroups";
type StatusFilter = "all" | "active" | "paused" | "ended";

const accountTree = [
  { name: "A 법률사무소", campaigns: ["형사변호사_파워링크"] },
  { name: "B 성형외과", campaigns: ["성형외과_브랜드"] },
  { name: "C 치과의원", campaigns: ["임플란트_전문"] },
  { name: "D 부동산", campaigns: ["아파트_매매"] },
  { name: "E 학원", campaigns: ["수학학원_겨울특강"] },
  { name: "F 인테리어", campaigns: ["인테리어_견적"] },
];

const initialCampaigns = [
  { id: 1, name: "형사변호사_파워링크", account: "A 법률사무소", status: "active", type: "WEB_SITE", budget: "500,000", spend: "₩423,000", impressions: "15,200", clicks: "820", ctr: "5.4%", cpc: "₩516", conversions: 12, roas: "380%" },
  { id: 2, name: "성형외과_브랜드", account: "B 성형외과", status: "active", type: "BRAND_SEARCH", budget: "800,000", spend: "₩712,000", impressions: "28,100", clicks: "1,420", ctr: "5.1%", cpc: "₩501", conversions: 8, roas: "210%" },
  { id: 3, name: "임플란트_전문", account: "C 치과의원", status: "active", type: "WEB_SITE", budget: "200,000", spend: "₩178,000", impressions: "8,400", clicks: "390", ctr: "4.6%", cpc: "₩456", conversions: 15, roas: "450%" },
  { id: 4, name: "아파트_매매", account: "D 부동산", status: "paused", type: "WEB_SITE", budget: "400,000", spend: "₩0", impressions: "0", clicks: "0", ctr: "-", cpc: "-", conversions: 0, roas: "-" },
  { id: 5, name: "수학학원_겨울특강", account: "E 학원", status: "active", type: "WEB_SITE", budget: "150,000", spend: "₩134,000", impressions: "6,200", clicks: "310", ctr: "5.0%", cpc: "₩432", conversions: 18, roas: "520%" },
  { id: 6, name: "인테리어_견적", account: "F 인테리어", status: "ended", type: "WEB_SITE", budget: "350,000", spend: "₩298,000", impressions: "12,800", clicks: "580", ctr: "4.5%", cpc: "₩514", conversions: 6, roas: "260%" },
];

const adGroups = [
  { id: 1, name: "GRP-형사변호사", campaign: "형사변호사_파워링크", status: "active", bid: "₩600", target: "PC+Mobile", keywords: 12, impressions: "8,000", clicks: "520", ctr: "6.5%", cost: "₩312,000", conversions: 8 },
  { id: 2, name: "GRP-교통사고", campaign: "형사변호사_파워링크", status: "active", bid: "₩400", target: "PC+Mobile", keywords: 8, impressions: "4,200", clicks: "280", ctr: "6.7%", cost: "₩112,000", conversions: 3 },
  { id: 3, name: "GRP-음주운전", campaign: "형사변호사_파워링크", status: "paused", bid: "₩350", target: "PC Only", keywords: 5, impressions: "1,800", clicks: "90", ctr: "5.0%", cost: "₩31,500", conversions: 1 },
  { id: 4, name: "GRP-쌍꺼풀수술", campaign: "성형외과_브랜드", status: "active", bid: "₩1,800", target: "PC+Mobile", keywords: 15, impressions: "12,000", clicks: "640", ctr: "5.3%", cost: "₩480,000", conversions: 5 },
  { id: 5, name: "GRP-코성형", campaign: "성형외과_브랜드", status: "active", bid: "₩1,500", target: "Mobile", keywords: 10, impressions: "8,500", clicks: "380", ctr: "4.5%", cost: "₩285,000", conversions: 3 },
  { id: 6, name: "GRP-임플란트", campaign: "임플란트_전문", status: "active", bid: "₩480", target: "PC+Mobile", keywords: 9, impressions: "6,100", clicks: "320", ctr: "5.2%", cost: "₩153,600", conversions: 12 },
];

const chartData = [
  { name: "A 법률", roas: 380, color: "#1E40AF" },
  { name: "B 성형", roas: 210, color: "#EF4444" },
  { name: "C 치과", roas: 450, color: "#10B981" },
  { name: "D 부동산", roas: 0, color: "#94A3B8" },
  { name: "E 학원", roas: 520, color: "#10B981" },
  { name: "F 인테리어", roas: 260, color: "#F59E0B" },
];

const statusFilters: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "전체" }, { key: "active", label: "활성" }, { key: "paused", label: "일시정지" }, { key: "ended", label: "종료" },
];

function CampaignsContent() {
  const searchParams = useSearchParams();
  const accountFromUrl = searchParams.get("account");
  const [viewTab, setViewTab] = useState<ViewTab>("campaigns");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [selectedCampaign, setSelectedCampaign] = useState("전체");
  const [treeAccount, setTreeAccount] = useState<string | null>(accountFromUrl || null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set(accountFromUrl ? [accountFromUrl] : []));
  const [drawerAdGroup, setDrawerAdGroup] = useState<number | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [newCampaignName, setNewCampaignName] = useState("");
  const [newCampaignAccount, setNewCampaignAccount] = useState("A 법률사무소");
  const [newCampaignBudget, setNewCampaignBudget] = useState("300,000");
  const [searchQuery, setSearchQuery] = useState("");
  const [adGroupBidValue, setAdGroupBidValue] = useState("");
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [period, setPeriod] = useState<typeof periods[number]>("7일");
  const [chartCollapsed, setChartCollapsed] = useState(true);
  const { addToast } = useToast();

  // ── API 데이터 페칭 (폴백 지원) ──
  const { data: apiCampaigns } = useCampaigns();
  const { data: apiAdGroups } = useAdGroups();

  useEffect(() => {
    if (apiCampaigns?.length > 0) {
      setCampaigns(apiCampaigns.map((c: any, i: number) => ({
        id: c.id ?? i + 1,
        name: c.name ?? '',
        account: c.naverAccount?.customerName ?? '',
        status: c.status?.toLowerCase() ?? 'active',
        type: c.campaignType ?? 'WEB_SITE',
        budget: (c.dailyBudget ?? 0).toLocaleString(),
        spend: `₩${(Number(c.totalCost ?? 0)).toLocaleString()}`,
        impressions: (c.impressions ?? 0).toLocaleString(),
        clicks: (c.clicks ?? 0).toLocaleString(),
        ctr: c.ctr ? `${(Number(c.ctr) * 100).toFixed(1)}%` : '-',
        cpc: c.cpc ? `₩${Number(c.cpc).toLocaleString()}` : '-',
        conversions: c.conversions ?? 0,
        roas: c.roas ? `${Number(c.roas).toFixed(0)}%` : '-',
      })));
    }
  }, [apiCampaigns]);

  // Sync account from URL param
  useEffect(() => {
    if (accountFromUrl) {
      setTreeAccount(accountFromUrl);
      setExpandedAccounts(new Set([accountFromUrl]));
    }
  }, [accountFromUrl]);

  const filteredCampaigns = campaigns.filter(
    (c) => (statusFilter === "all" || c.status === statusFilter) &&
           (treeAccount === null || c.account === treeAccount) &&
           (searchQuery === "" || c.name.toLowerCase().includes(searchQuery.toLowerCase()) || c.account.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const filteredAdGroups = adGroups.filter(
    (ag) => (statusFilter === "all" || ag.status === statusFilter) &&
            (selectedCampaign === "전체" || ag.campaign === selectedCampaign) &&
            (searchQuery === "" || ag.name.toLowerCase().includes(searchQuery.toLowerCase()) || ag.campaign.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleRow = (id: number) => {
    setSelectedRows((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const toggleExpand = (name: string) => {
    setExpandedAccounts((prev) => { const next = new Set(prev); next.has(name) ? next.delete(name) : next.add(name); return next; });
  };

  const adGroupDetail = adGroups.find((ag) => ag.id === drawerAdGroup);

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">캠페인 관리</h1>
        <div className="main-header-actions">
          {/* Date Selector */}
          <div style={{ display: "flex", gap: 4, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", padding: 2 }}>
            {periods.map((p) => (
              <button key={p} className={`btn btn-sm ${period === p ? "btn-primary" : "btn-ghost"}`} style={{ fontSize: "0.786rem", padding: "4px 12px" }} onClick={() => setPeriod(p)}>{p}</button>
            ))}
          </div>
          <button className="btn btn-secondary"><Filter size={16} /> 필터</button>
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={16} /> 캠페인 생성</button>
        </div>
      </header>
      <div className="main-body">
        <div style={{ display: "flex", gap: 20 }}>
          {/* 4-A: Left Account Tree Nav */}
          <div style={{ width: 200, flexShrink: 0 }}>
            <div style={{ fontSize: "0.714rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase", letterSpacing: 1 }}>계정 트리</div>
            <div
              onClick={() => setTreeAccount(null)}
              style={{ padding: "6px 10px", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.857rem", fontWeight: treeAccount === null ? 600 : 400, background: treeAccount === null ? "var(--primary-light)" : undefined, color: treeAccount === null ? "var(--primary)" : "var(--text-primary)", marginBottom: 4 }}
            >전체 계정</div>
            {accountTree.map((acc) => (
              <div key={acc.name}>
                <div
                  onClick={() => { toggleExpand(acc.name); setTreeAccount(acc.name); }}
                  style={{ display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: "var(--radius-md)", cursor: "pointer", fontSize: "0.857rem", fontWeight: treeAccount === acc.name ? 600 : 400, background: treeAccount === acc.name ? "var(--primary-light)" : undefined, color: treeAccount === acc.name ? "var(--primary)" : "var(--text-primary)", marginBottom: 2 }}
                >
                  {expandedAccounts.has(acc.name) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  {acc.name}
                </div>
                {expandedAccounts.has(acc.name) && acc.campaigns.map((c) => (
                  <div key={c} style={{ padding: "4px 10px 4px 30px", fontSize: "0.786rem", color: "var(--text-secondary)", cursor: "pointer" }}>{c}</div>
                ))}
              </div>
            ))}
          </div>

          {/* Right Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* View Tab + Status Filter */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)", padding: 3, width: "fit-content" }}>
              <button className={`btn btn-sm ${viewTab === "campaigns" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setViewTab("campaigns"); setSelectedRows(new Set()); }}>📋 캠페인</button>
              <button className={`btn btn-sm ${viewTab === "adgroups" ? "btn-primary" : "btn-ghost"}`} onClick={() => { setViewTab("adgroups"); setSelectedRows(new Set()); }}>📦 광고그룹</button>
            </div>

            <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
              {statusFilters.map((f) => (
                <button key={f.key} className={`btn btn-sm ${statusFilter === f.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatusFilter(f.key)}>
                  {f.label}
                  {f.key !== "all" && <span style={{ marginLeft: 4, fontSize: "0.714rem", opacity: 0.7 }}>({(viewTab === "campaigns" ? campaigns : adGroups).filter((c) => c.status === f.key).length})</span>}
                </button>
              ))}
              {viewTab === "adgroups" && (
                <select className="form-input" style={{ marginLeft: "auto", width: 200, padding: "4px 8px", fontSize: "0.857rem" }} value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
                  <option value="전체">전체 캠페인</option>
                  {campaigns.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
              )}
            </div>

            {/* Bulk Action Bar */}
            {selectedRows.size > 0 && (
              <div style={{ display: "flex", gap: 8, marginBottom: 16, padding: "10px 16px", background: "var(--primary-light)", borderRadius: "var(--radius-lg)", alignItems: "center" }}>
                <span style={{ fontSize: "0.857rem", color: "var(--primary)", fontWeight: 600 }}>{selectedRows.size}개 선택됨:</span>
                <button className="btn btn-sm btn-secondary" onClick={() => {
                  setCampaigns((prev) => prev.map((c) => selectedRows.has(c.id) ? { ...c, status: "active" } : c));
                  addToast("success", `${selectedRows.size}개 캠페인 활성화`, "선택된 캠페인이 활성 상태로 변경되었습니다.");
                  setSelectedRows(new Set());
                }}>활성화</button>
                <button className="btn btn-sm btn-secondary" onClick={() => {
                  setCampaigns((prev) => prev.map((c) => selectedRows.has(c.id) ? { ...c, status: "paused" } : c));
                  addToast("warning", `${selectedRows.size}개 캠페인 일시정지`, "선택된 캠페인이 일시정지되었습니다.");
                  setSelectedRows(new Set());
                }} style={{ color: "var(--error)" }}>일시정지</button>
              </div>
            )}

            {/* Chart — Collapsible */}
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-header" style={{ cursor: "pointer" }} onClick={() => setChartCollapsed(c => !c)}>
                <h3><BarChart3 size={18} style={{ marginRight: 8, verticalAlign: "middle" }} />계정별 ROAS 비교 ({period})</h3>
                <button className="btn btn-ghost btn-sm">
                  {chartCollapsed ? <><ChevronDown size={16} /> 펼치기</> : <><ChevronUp size={16} /> 접기</>}
                </button>
              </div>
              {!chartCollapsed && (
                <div className="card-body">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                      <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} />
                      <YAxis stroke="var(--text-muted)" fontSize={12} unit="%" />
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid var(--border)" }} formatter={(v) => [`${v}%`, "ROAS"]} />
                      <Bar dataKey="roas" radius={[6, 6, 0, 0]}>{chartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}</Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
              {chartCollapsed && (
                <div style={{ padding: "8px 24px 12px", display: "flex", gap: 16, fontSize: "0.857rem", color: "var(--text-secondary)" }}>
                  {chartData.filter(d => d.roas > 0).map(d => (
                    <span key={d.name} style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: d.color }} />
                      {d.name}: <strong style={{ color: d.roas > 300 ? "var(--success)" : d.roas > 200 ? "var(--warning)" : "var(--error)" }}>{d.roas}%</strong>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Table + Drawer layout */}
            <div style={{ display: "flex", gap: 20 }}>
              <div className="card" style={{ flex: 1 }}>
                <div className="card-header">
                  <h3>{viewTab === "campaigns" ? "캠페인 목록" : "광고그룹 목록"}</h3>
                  <div style={{ position: "relative" }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: 8 }} />
                    <input className="form-input" placeholder={`${viewTab === "campaigns" ? "캠페인" : "광고그룹"} 검색...`} style={{ paddingLeft: 32, width: 220, padding: "6px 12px 6px 32px" }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
                  </div>
                </div>
                <div className="table-wrapper">
                  {viewTab === "campaigns" ? (
                    <table>
                      <thead><tr><th style={{ width: 32 }}><input type="checkbox" /></th><th>캠페인</th><th>계정</th><th>상태</th><th>일예산</th><th>지출</th><th>클릭</th><th>전환</th><th>ROAS</th></tr></thead>
                      <tbody>
                        {filteredCampaigns.map((c) => (
                          <tr key={c.id} style={{ background: selectedRows.has(c.id) ? "var(--primary-light)" : undefined }}>
                            <td><input type="checkbox" checked={selectedRows.has(c.id)} onChange={() => toggleRow(c.id)} /></td>
                            <td style={{ fontWeight: 600 }}>{c.name}</td>
                            <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{c.account}</td>
                            <td>{c.status === "active" ? <span className="badge badge-success"><Play size={10} /> 활성</span> : c.status === "paused" ? <span className="badge badge-warning"><Pause size={10} /> 일시정지</span> : <span className="badge badge-error"><Square size={10} /> 종료</span>}</td>
                            <td>₩{c.budget}</td><td style={{ fontWeight: 600 }}>{c.spend}</td><td>{c.clicks}</td><td style={{ fontWeight: 600 }}>{c.conversions}</td>
                            <td style={{ fontWeight: 700, color: parseInt(c.roas) > 300 ? "var(--success)" : parseInt(c.roas) > 200 ? "var(--warning)" : c.roas === "-" ? "var(--text-muted)" : "var(--error)" }}>{c.roas}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <table>
                      <thead><tr><th style={{ width: 32 }}><input type="checkbox" /></th><th>광고그룹</th><th>상태</th><th>입찰가</th><th>타겟</th><th>키워드</th><th>클릭</th><th>비용</th><th></th></tr></thead>
                      <tbody>
                        {filteredAdGroups.map((ag) => (
                          <tr key={ag.id} style={{ background: selectedRows.has(ag.id) ? "var(--primary-light)" : drawerAdGroup === ag.id ? "var(--surface-hover)" : undefined, cursor: "pointer" }} onClick={() => setDrawerAdGroup(ag.id)}>
                            <td><input type="checkbox" checked={selectedRows.has(ag.id)} onChange={(e) => { e.stopPropagation(); toggleRow(ag.id); }} /></td>
                            <td style={{ fontWeight: 600 }}>{ag.name}</td>
                            <td>{ag.status === "active" ? <span className="badge badge-success"><Play size={10} /> 활성</span> : <span className="badge badge-warning"><Pause size={10} /> 일시정지</span>}</td>
                            <td style={{ fontWeight: 600 }}>{ag.bid}</td>
                            <td><span className="badge badge-info">{ag.target}</span></td>
                            <td style={{ color: "var(--primary)", fontWeight: 600 }}>{ag.keywords}개</td>
                            <td>{ag.clicks}</td><td style={{ fontWeight: 600 }}>{ag.cost}</td>
                            <td><ChevronRight size={16} color="var(--text-muted)" /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>

              {/* 4-H: Ad Group Detail Drawer */}
              {viewTab === "adgroups" && adGroupDetail && (
                <div className="card" style={{ width: 300, flexShrink: 0 }}>
                  <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ fontSize: "0.929rem" }}>{adGroupDetail.name}</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDrawerAdGroup(null)}><X size={16} /></button>
                  </div>
                  <div className="card-body">
                    {[
                      { label: "캠페인", value: adGroupDetail.campaign },
                      { label: "상태", value: adGroupDetail.status === "active" ? "🟢 활성" : "🟡 일시정지" },
                      { label: "입찰가", value: adGroupDetail.bid },
                      { label: "타겟 플랫폼", value: adGroupDetail.target },
                      { label: "키워드 수", value: `${adGroupDetail.keywords}개` },
                      { label: "노출", value: adGroupDetail.impressions },
                      { label: "클릭", value: adGroupDetail.clicks },
                      { label: "CTR", value: adGroupDetail.ctr },
                      { label: "비용", value: adGroupDetail.cost },
                      { label: "전환", value: `${adGroupDetail.conversions}건` },
                    ].map((item) => (
                      <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: "0.857rem" }}>
                        <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                        <span style={{ fontWeight: 600 }}>{item.value}</span>
                      </div>
                    ))}
                    <div style={{ marginTop: 16 }}>
                      <div className="form-group">
                        <label className="form-label" style={{ fontSize: "0.786rem" }}>입찰가 수정</label>
                        <input className="form-input" defaultValue={adGroupDetail.bid.replace("₩", "").replace(",", "")} type="number" onChange={(e) => setAdGroupBidValue(e.target.value)} />
                      </div>
                      <button className="btn btn-sm btn-primary" style={{ width: "100%" }} onClick={() => { addToast("success", "입찰가 적용 완료", `'${adGroupDetail.name}' 입찰가가 ₩${adGroupBidValue || adGroupDetail.bid}(으)로 변경되었습니다.`); }}>입찰가 적용</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Campaign Creation Modal */}
      {showCreateModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "var(--bg-card, var(--surface))", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 520, width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3>📋 새 캠페인 생성</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <div className="form-group">
              <label className="form-label">캠페인명</label>
              <input className="form-input" placeholder="예: 봄시즌_프로모션" value={newCampaignName} onChange={(e) => setNewCampaignName(e.target.value)} />
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group">
                <label className="form-label">계정</label>
                <select className="form-input" value={newCampaignAccount} onChange={(e) => setNewCampaignAccount(e.target.value)}>
                  {accountTree.map((a) => <option key={a.name}>{a.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">유형</label>
                <select className="form-input">
                  <option>WEB_SITE (파워링크)</option>
                  <option>BRAND_SEARCH (브랜드검색)</option>
                  <option>SHOPPING (쇼핑검색)</option>
                </select>
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">일예산 (₩)</label>
              <input className="form-input" placeholder="300,000" value={newCampaignBudget} onChange={(e) => setNewCampaignBudget(e.target.value)} />
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 16 }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={() => {
                if (!newCampaignName.trim()) { addToast("error", "캠페인명을 입력해주세요"); return; }
                const newId = Math.max(...campaigns.map((c) => c.id)) + 1;
                setCampaigns((prev) => [...prev, {
                  id: newId, name: newCampaignName, account: newCampaignAccount, status: "active",
                  type: "WEB_SITE", budget: newCampaignBudget, spend: "₩0", impressions: "0", clicks: "0",
                  ctr: "-", cpc: "-", conversions: 0, roas: "-",
                }]);
                addToast("success", "캠페인 생성 완료", `'${newCampaignName}' 캠페인이 생성되었습니다.`);
                setNewCampaignName("");
                setShowCreateModal(false);
              }}>
                <Plus size={16} /> 캠페인 생성
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default function CampaignsPage() {
  return (
    <Suspense fallback={<div className="main-body" style={{ display: "flex", justifyContent: "center", padding: 40 }}>로딩 중...</div>}>
      <CampaignsContent />
    </Suspense>
  );
}
