"use client";

import { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Search, Play, Pause, ChevronUp, ChevronDown,
  X, Megaphone, TestTube2, Trophy, BarChart3, ArrowRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { useToast } from "@/components/Toast";
import { useAds } from "@/hooks/useApi";
import Modal from "@/components/Modal";
import Breadcrumb from "@/components/Breadcrumb";
import FunnelChart, { type FunnelStep } from "@/components/FunnelChart";

type StatusFilter = "all" | "active" | "paused";
type ViewMode = "list" | "abtest" | "funnel";

interface AdData {
  id: number;
  adGroupId: number;
  adGroup: string;
  title: string;
  description: string;
  displayUrl: string;
  landingUrl: string;
  status: string;
  impressions: number;
  clicks: number;
  ctr: number;
  conversions: number;
  cost: number;
  testGroupId?: string | null;
  isControl?: boolean;
  testStatus?: string | null;
}

// ── Mock 데이터 ──
const initialAds: AdData[] = [
  { id: 1, adGroupId: 1, adGroup: "GRP-형사변호사", title: "당신의 든든한 법률 파트너", description: "초기 대응이 가장 중요합니다. 24시간 특별 전담팀 온라인 무료 파워텍스트", displayUrl: "law.example.com", landingUrl: "law.example.com/landing", status: "active", impressions: 1200, clicks: 45, ctr: 0.0375, conversions: 5, cost: 135000, testGroupId: "test-1", isControl: true, testStatus: "running" },
  { id: 2, adGroupId: 1, adGroup: "GRP-형사변호사", title: "무료 상담 중 | 형사사건 전문 변호사", description: "승소율로 증명하는 법무법인. 비밀 보장 1:1 상담 예약.", displayUrl: "law.example.com/consult", landingUrl: "law.example.com/consulting", status: "active", impressions: 2100, clicks: 112, ctr: 0.0533, conversions: 12, cost: 224000, testGroupId: "test-1", isControl: false, testStatus: "running" },
  { id: 3, adGroupId: 3, adGroup: "GRP-음주운전", title: "음주운전 구제 전문", description: "면허취소/정지 구제 확률 98%. 즉각 무료 상담 신청.", displayUrl: "law.example.com/dui", landingUrl: "law.example.com/dui", status: "paused", impressions: 500, clicks: 15, ctr: 0.03, conversions: 2, cost: 30000, testGroupId: null, isControl: false, testStatus: null },
  { id: 4, adGroupId: 4, adGroup: "GRP-쌍꺼풀수술", title: "자연스러운 눈매 교정", description: "회복이 빠른 수술법 적용. 첫 방문 10% 혜택 이벤트", displayUrl: "clinic.example.com", landingUrl: "clinic.example.com/eye", status: "active", impressions: 4500, clicks: 320, ctr: 0.0711, conversions: 38, cost: 960000, testGroupId: "test-2", isControl: true, testStatus: "running" },
  { id: 5, adGroupId: 6, adGroup: "GRP-임플란트", title: "디지털 네비게이션 임플란트", description: "출혈 및 통증 최소화. 빠른 일상 회복. 임플란트 명의가 직접 수술.", displayUrl: "dental.example.com", landingUrl: "dental.example.com/implant", status: "active", impressions: 3100, clicks: 180, ctr: 0.058, conversions: 22, cost: 540000, testGroupId: "test-2", isControl: false, testStatus: "running" },
];

const adGroupsList = ["전체", "GRP-형사변호사", "GRP-교통사고", "GRP-음주운전", "GRP-쌍꺼풀수술", "GRP-코성형", "GRP-임플란트"];

// ── A/B 테스트 승자 판정 ──
function determineWinner(control: AdData, variant: AdData): "control" | "variant" | "insufficient" {
  if (control.clicks < 100 || variant.clicks < 100) return "insufficient";
  const controlCVR = control.conversions / control.clicks;
  const variantCVR = variant.conversions / variant.clicks;
  const pooledP = (control.conversions + variant.conversions) / (control.clicks + variant.clicks);
  const se = Math.sqrt(pooledP * (1 - pooledP) * (1 / control.clicks + 1 / variant.clicks));
  if (se === 0) return "insufficient";
  const z = (variantCVR - controlCVR) / se;
  if (Math.abs(z) >= 1.96) return z > 0 ? "variant" : "control";
  return "insufficient";
}

function AdsContent() {
  const searchParams = useSearchParams();
  const adGroupFromUrl = searchParams.get("adGroup");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedAdGroup, setSelectedAdGroup] = useState<string>(adGroupFromUrl || "전체");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [ads, setAds] = useState<AdData[]>(initialAds);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("list");
  const { addToast } = useToast();

  // ── API 데이터 페칭 ──
  const { data: apiAds } = useAds();
  useEffect(() => {
    if (apiAds?.length > 0) {
      setAds(apiAds.map((a: any, i: number) => ({
        id: a.id ?? i + 1, adGroupId: a.adGroupId ?? 0, adGroup: a.adGroup?.name ?? "",
        title: a.title ?? "", description: a.description ?? "",
        displayUrl: a.displayUrl ?? "", landingUrl: a.landingUrl ?? "",
        status: a.status?.toLowerCase() ?? "active",
        impressions: Number(a.impressions ?? 0), clicks: Number(a.clicks ?? 0),
        ctr: Number(a.ctr ?? 0), conversions: Number(a.conversions ?? 0),
        cost: Number(a.cost ?? 0),
        testGroupId: a.testGroupId ?? null, isControl: a.isControl ?? false,
        testStatus: a.testStatus ?? null,
      })));
    }
  }, [apiAds]);

  // ── Create Form State ──
  const [newAdTitle, setNewAdTitle] = useState("");
  const [newAdDesc, setNewAdDesc] = useState("");
  const [newAdGroup, setNewAdGroup] = useState("GRP-형사변호사");
  const [newAdDisplayUrl, setNewAdDisplayUrl] = useState("");
  const [newAdLandingUrl, setNewAdLandingUrl] = useState("");

  const filteredAds = ads.filter(
    (a) => (statusFilter === "all" || a.status === statusFilter) &&
           (selectedAdGroup === "전체" || a.adGroup === selectedAdGroup) &&
           (searchQuery === "" || a.title.toLowerCase().includes(searchQuery.toLowerCase()) || a.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const toggleRow = (id: number) => {
    setSelectedRows((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const statusFilters: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "전체" }, { key: "active", label: "활성" }, { key: "paused", label: "일시정지" }
  ];

  // ── A/B 테스트 그룹 ──
  const abTestGroups = useMemo(() => {
    const groups = new Map<string, { control: AdData | null; variants: AdData[] }>();
    ads.filter(a => a.testGroupId).forEach(a => {
      const existing = groups.get(a.testGroupId!) || { control: null, variants: [] };
      if (a.isControl) existing.control = a;
      else existing.variants.push(a);
      groups.set(a.testGroupId!, existing);
    });
    return groups;
  }, [ads]);

  // ── 전환 퍼널 데이터 ──
  const funnelData: FunnelStep[] = useMemo(() => {
    const totalImpressions = filteredAds.reduce((s, a) => s + a.impressions, 0);
    const totalClicks = filteredAds.reduce((s, a) => s + a.clicks, 0);
    const totalConversions = filteredAds.reduce((s, a) => s + a.conversions, 0);
    return [
      { label: "노출", value: totalImpressions, color: "#1E40AF" },
      { label: "클릭", value: totalClicks, color: "#3B82F6" },
      { label: "전환", value: totalConversions, color: "#10B981" },
    ];
  }, [filteredAds]);

  const handleCreate = () => {
    if (!newAdTitle.trim() || !newAdDesc.trim()) { addToast("error", "제목과 설명을 모두 입력해주세요"); return; }
    const newId = Math.max(...ads.map(a => a.id), 0) + 1;
    setAds(prev => [{
      id: newId, adGroupId: 999, adGroup: newAdGroup, title: newAdTitle, description: newAdDesc,
      displayUrl: newAdDisplayUrl || "example.com", landingUrl: newAdLandingUrl || "example.com",
      status: "active", impressions: 0, clicks: 0, ctr: 0, conversions: 0, cost: 0,
      testGroupId: null, isControl: false, testStatus: null,
    }, ...prev]);
    addToast("success", "소재 등록 완료", "새로운 광고 소재가 등록되었습니다.");
    setNewAdTitle(""); setNewAdDesc(""); setNewAdDisplayUrl(""); setNewAdLandingUrl(""); setShowCreateModal(false);
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">광고 소재 관리</h1>
        <div className="main-header-actions">
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}><Plus size={16} /> 소재 등록</button>
        </div>
      </header>
      <div className="main-body">
        <Breadcrumb items={[{ label: "대시보드", href: "/dashboard" }, { label: "광고 소재" }]} />

        {/* 뷰 모드 탭 */}
        <div className="tabs mb-4">
          <button className={`tab ${viewMode === "list" ? "active" : ""}`} onClick={() => setViewMode("list")}>📋 소재 목록</button>
          <button className={`tab ${viewMode === "abtest" ? "active" : ""}`} onClick={() => setViewMode("abtest")}>🧪 A/B 테스트</button>
          <button className={`tab ${viewMode === "funnel" ? "active" : ""}`} onClick={() => setViewMode("funnel")}>📊 전환 퍼널</button>
        </div>

        {/* ── 목록 뷰 ── */}
        {viewMode === "list" && (
          <div className="card">
            <div className="card-header" style={{ paddingBottom: 0 }}>
              <div className="flex-between flex-wrap gap-4 w-full mb-4">
                <div className="flex-center gap-2">
                  {statusFilters.map(f => (
                    <button key={f.key} className={`btn btn-sm ${statusFilter === f.key ? "btn-primary" : "btn-ghost"}`} onClick={() => setStatusFilter(f.key)}>
                      {f.label}
                      {f.key !== "all" && <span style={{ marginLeft: 4, fontSize: "0.714rem", opacity: 0.7 }}>({ads.filter(a => a.status === f.key).length})</span>}
                    </button>
                  ))}
                  <select className="form-input" style={{ width: 180, padding: "4px 8px", fontSize: "0.857rem" }} value={selectedAdGroup} onChange={e => setSelectedAdGroup(e.target.value)}>
                    {adGroupsList.map(ag => <option key={ag} value={ag}>{ag}</option>)}
                  </select>
                </div>
                <div style={{ position: "relative" }}>
                  <Search size={16} color="var(--text-muted)" style={{ position: "absolute", left: 10, top: 8 }} />
                  <input className="form-input" placeholder="소재 제목/설명 검색..." style={{ paddingLeft: 32, width: 260 }} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                </div>
              </div>
            </div>

            {selectedRows.size > 0 && (
              <div className="flex-center gap-2" style={{ padding: "10px 16px", background: "var(--primary-light)", borderBottom: "1px solid var(--border)" }}>
                <span style={{ fontSize: "0.857rem", color: "var(--primary)", fontWeight: 600 }}>{selectedRows.size}개 선택됨:</span>
                <button className="btn btn-sm btn-secondary" onClick={() => {
                  setAds(prev => prev.map(a => selectedRows.has(a.id) ? { ...a, status: "active" } : a));
                  addToast("success", `${selectedRows.size}개 소재 활성화`);
                  setSelectedRows(new Set());
                }}>활성화</button>
                <button className="btn btn-sm btn-secondary" onClick={() => {
                  setAds(prev => prev.map(a => selectedRows.has(a.id) ? { ...a, status: "paused" } : a));
                  addToast("warning", `${selectedRows.size}개 소재 일시정지`);
                  setSelectedRows(new Set());
                }} style={{ color: "var(--error)" }}>일시정지</button>
              </div>
            )}

            <div className="table-wrapper">
              <table className="table-sticky">
                <thead>
                  <tr>
                    <th style={{ width: 32 }}><input type="checkbox" /></th>
                    <th style={{ width: "25%" }}>광고 소재(제목/설명)</th>
                    <th>광고그룹</th>
                    <th>상태</th>
                    <th>노출수</th>
                    <th>클릭수</th>
                    <th>CTR</th>
                    <th>전환</th>
                    <th>비용</th>
                    <th>A/B</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredAds.map(a => (
                    <tr key={a.id} style={{ background: selectedRows.has(a.id) ? "var(--primary-light)" : undefined }}>
                      <td><input type="checkbox" checked={selectedRows.has(a.id)} onChange={() => toggleRow(a.id)} /></td>
                      <td>
                        <div style={{ fontWeight: 600, color: "var(--text-primary)", marginBottom: 4 }}>{a.title}</div>
                        <div style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>{a.description}</div>
                      </td>
                      <td style={{ fontSize: "0.857rem" }}>{a.adGroup}</td>
                      <td>{a.status === "active" ? <span className="badge badge-success"><Play size={10} /> 활성</span> : <span className="badge badge-warning"><Pause size={10} /> 정지</span>}</td>
                      <td>{a.impressions.toLocaleString()}</td>
                      <td>{a.clicks.toLocaleString()}</td>
                      <td style={{ fontWeight: 600 }}>{(a.ctr * 100).toFixed(2)}%</td>
                      <td>{a.conversions}</td>
                      <td>₩{a.cost.toLocaleString()}</td>
                      <td>
                        {a.testGroupId && (
                          <span className={`badge ${a.isControl ? "badge-info" : "badge-warning"}`}>
                            {a.isControl ? "Control" : "Variant"}
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filteredAds.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ textAlign: "center", padding: "40px 0", color: "var(--text-muted)" }}>
                        <Megaphone size={32} color="var(--border)" style={{ margin: "0 auto 12px", display: "block" }} />
                        등록된 소재가 없거나 검색 결과가 없습니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── A/B 테스트 뷰 ── */}
        {viewMode === "abtest" && (
          <div className="grid-2 gap-6">
            {Array.from(abTestGroups.entries()).map(([groupId, group]) => {
              if (!group.control) return null;
              return group.variants.map(variant => {
                const winner = determineWinner(group.control!, variant);
                const controlCVR = group.control!.clicks > 0 ? (group.control!.conversions / group.control!.clicks * 100).toFixed(2) : "0";
                const variantCVR = variant.clicks > 0 ? (variant.conversions / variant.clicks * 100).toFixed(2) : "0";
                const chartData = [
                  { name: "CTR", control: +(group.control!.ctr * 100).toFixed(2), variant: +(variant.ctr * 100).toFixed(2) },
                  { name: "CVR", control: +controlCVR, variant: +variantCVR },
                ];

                return (
                  <div key={`${groupId}-${variant.id}`} className="card">
                    <div className="card-header">
                      <div className="flex-center gap-2">
                        <TestTube2 size={18} color="var(--primary)" />
                        <h4>A/B 테스트 — {group.control!.adGroup}</h4>
                      </div>
                      <span className={`badge ${winner === "insufficient" ? "badge-warning" : "badge-success"}`}>
                        {winner === "insufficient" ? "⏳ 데이터 수집 중" : winner === "control" ? "🏅 Control 승" : "🏅 Variant 승"}
                      </span>
                    </div>
                    <div className="card-body">
                      <div className="grid-2 gap-4 mb-4">
                        {/* Control */}
                        <div style={{ padding: 16, background: "var(--info-bg)", borderRadius: "var(--radius-lg)", border: winner === "control" ? "2px solid var(--success)" : "1px solid var(--border)" }}>
                          <div className="flex-center gap-2 mb-4">
                            <span className="badge badge-info">Control</span>
                            {winner === "control" && <Trophy size={16} color="var(--success)" />}
                          </div>
                          <p style={{ fontWeight: 600, fontSize: "0.929rem", marginBottom: 4 }}>{group.control!.title}</p>
                          <p style={{ fontSize: "0.786rem", color: "var(--text-secondary)", marginBottom: 12 }}>{group.control!.description}</p>
                          <div className="grid-2 gap-2" style={{ fontSize: "0.857rem" }}>
                            <div>CTR <strong>{(group.control!.ctr * 100).toFixed(2)}%</strong></div>
                            <div>CVR <strong>{controlCVR}%</strong></div>
                            <div>클릭 <strong>{group.control!.clicks.toLocaleString()}</strong></div>
                            <div>전환 <strong>{group.control!.conversions}</strong></div>
                          </div>
                        </div>
                        {/* Variant */}
                        <div style={{ padding: 16, background: "var(--warning-bg)", borderRadius: "var(--radius-lg)", border: winner === "variant" ? "2px solid var(--success)" : "1px solid var(--border)" }}>
                          <div className="flex-center gap-2 mb-4">
                            <span className="badge badge-warning">Variant</span>
                            {winner === "variant" && <Trophy size={16} color="var(--success)" />}
                          </div>
                          <p style={{ fontWeight: 600, fontSize: "0.929rem", marginBottom: 4 }}>{variant.title}</p>
                          <p style={{ fontSize: "0.786rem", color: "var(--text-secondary)", marginBottom: 12 }}>{variant.description}</p>
                          <div className="grid-2 gap-2" style={{ fontSize: "0.857rem" }}>
                            <div>CTR <strong>{(variant.ctr * 100).toFixed(2)}%</strong></div>
                            <div>CVR <strong>{variantCVR}%</strong></div>
                            <div>클릭 <strong>{variant.clicks.toLocaleString()}</strong></div>
                            <div>전환 <strong>{variant.conversions}</strong></div>
                          </div>
                        </div>
                      </div>

                      {/* 비교 차트 */}
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={chartData} barGap={4}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                          <XAxis dataKey="name" fontSize={12} />
                          <YAxis fontSize={12} unit="%" />
                          <Tooltip formatter={(v: any) => [`${v}%`]} />
                          <Bar dataKey="control" fill="#3B82F6" name="Control" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="variant" fill="#F59E0B" name="Variant" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                );
              });
            })}
            {abTestGroups.size === 0 && (
              <div className="card p-6" style={{ textAlign: "center", color: "var(--text-muted)", gridColumn: "1 / -1" }}>
                <TestTube2 size={40} color="var(--border)" style={{ margin: "0 auto 16px", display: "block" }} />
                <p>실행 중인 A/B 테스트가 없습니다.</p>
                <p style={{ fontSize: "0.857rem" }}>소재를 등록하고 A/B 테스트를 시작해보세요.</p>
              </div>
            )}
          </div>
        )}

        {/* ── 전환 퍼널 뷰 ── */}
        {viewMode === "funnel" && (
          <div className="card">
            <div className="card-header">
              <h3 className="flex-center gap-2"><BarChart3 size={18} /> 전환 퍼널 분석</h3>
            </div>
            <div className="card-body">
              <FunnelChart data={funnelData} />
              <div className="grid-3 gap-4 mt-4">
                <div style={{ textAlign: "center", padding: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)" }}>
                  <div style={{ fontSize: "0.786rem", color: "var(--text-muted)", marginBottom: 4 }}>평균 CTR</div>
                  <div style={{ fontSize: "1.714rem", fontWeight: 700, color: "var(--primary)" }}>
                    {funnelData[0].value > 0 ? (funnelData[1].value / funnelData[0].value * 100).toFixed(2) : 0}%
                  </div>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)" }}>
                  <div style={{ fontSize: "0.786rem", color: "var(--text-muted)", marginBottom: 4 }}>평균 CVR</div>
                  <div style={{ fontSize: "1.714rem", fontWeight: 700, color: "var(--success)" }}>
                    {funnelData[1].value > 0 ? (funnelData[2].value / funnelData[1].value * 100).toFixed(2) : 0}%
                  </div>
                </div>
                <div style={{ textAlign: "center", padding: 16, background: "var(--surface-hover)", borderRadius: "var(--radius-lg)" }}>
                  <div style={{ fontSize: "0.786rem", color: "var(--text-muted)", marginBottom: 4 }}>전체 전환율</div>
                  <div style={{ fontSize: "1.714rem", fontWeight: 700, color: "var(--warning)" }}>
                    {funnelData[0].value > 0 ? (funnelData[2].value / funnelData[0].value * 100).toFixed(3) : 0}%
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 소재 등록 모달 (공통 Modal 컴포넌트 사용) ── */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="✍️ 새 광고 소재 등록"
        size="lg"
        footer={
          <>
            <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)}>취소</button>
            <button className="btn btn-primary" onClick={handleCreate}><Plus size={16} /> 소재 등록</button>
          </>
        }
      >
        <div className="form-group">
          <label className="form-label">광고그룹</label>
          <select className="form-input" value={newAdGroup} onChange={e => setNewAdGroup(e.target.value)}>
            {adGroupsList.filter(g => g !== "전체").map(ag => <option key={ag} value={ag}>{ag}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">소재 제목 (최대 15자)</label>
          <input className="form-input" placeholder="빠르고 확실한 법률 상담" value={newAdTitle} onChange={e => setNewAdTitle(e.target.value)} maxLength={15} />
          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{newAdTitle.length} / 15</div>
        </div>
        <div className="form-group">
          <label className="form-label">소재 설명 (최대 45자)</label>
          <textarea className="form-input" placeholder="수많은 승소 사례로 증명합니다. 지금 바로 상담하세요." value={newAdDesc} onChange={e => setNewAdDesc(e.target.value)} maxLength={45} rows={3} />
          <div style={{ textAlign: "right", fontSize: "0.75rem", color: "var(--text-muted)", marginTop: 4 }}>{newAdDesc.length} / 45</div>
        </div>
        <div className="grid-2 gap-3">
          <div className="form-group">
            <label className="form-label">표시 URL</label>
            <input className="form-input" placeholder="www.example.com" value={newAdDisplayUrl} onChange={e => setNewAdDisplayUrl(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">연결 URL</label>
            <input className="form-input" placeholder="www.example.com/landing" value={newAdLandingUrl} onChange={e => setNewAdLandingUrl(e.target.value)} />
          </div>
        </div>
      </Modal>
    </>
  );
}

export default function AdsPage() {
  return (
    <Suspense fallback={<div className="main-body" style={{ display: "flex", justifyContent: "center", padding: 40 }}>로딩 중...</div>}>
      <AdsContent />
    </Suspense>
  );
}
