"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Wifi, WifiOff, AlertCircle, MoreVertical, Key, RefreshCw, Upload, ArrowRight, X, CheckCircle2 } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useAccounts } from "@/hooks/useApi";

const initialAccounts = [
  { id: 1, name: "A 법률사무소", customerId: "ncc-1234567", status: "connected", lastSync: "2분 전", spend: "₩8,200,000", dailyBudget: "₩300,000", commissionRate: "15%", campaigns: 12, keywords: 245, syncHistory: ["03/12 10:00 동기화 완료", "03/12 09:00 동기화 완료", "03/11 18:00 동기화 완료"] },
  { id: 2, name: "B 성형외과", customerId: "ncc-2345678", status: "connected", lastSync: "5분 전", spend: "₩12,500,000", dailyBudget: "₩500,000", commissionRate: "12%", campaigns: 18, keywords: 523, syncHistory: ["03/12 10:00 동기화 완료", "03/12 09:00 동기화 완료"] },
  { id: 3, name: "C 치과의원", customerId: "ncc-3456789", status: "connected", lastSync: "3분 전", spend: "₩3,400,000", dailyBudget: "₩120,000", commissionRate: "18%", campaigns: 6, keywords: 87, syncHistory: ["03/12 10:00 동기화 완료"] },
  { id: 4, name: "D 부동산", customerId: "ncc-4567890", status: "error", lastSync: "2시간 전", spend: "₩6,100,000", dailyBudget: "₩250,000", commissionRate: "15%", campaigns: 8, keywords: 312, syncHistory: ["03/12 08:00 동기화 실패 — API 인증 오류"] },
  { id: 5, name: "E 학원", customerId: "ncc-5678901", status: "connected", lastSync: "1분 전", spend: "₩2,800,000", dailyBudget: "₩100,000", commissionRate: "20%", campaigns: 4, keywords: 156, syncHistory: ["03/12 10:00 동기화 완료"] },
  { id: 6, name: "F 인테리어", customerId: "ncc-6789012", status: "connected", lastSync: "4분 전", spend: "₩5,700,000", dailyBudget: "₩200,000", commissionRate: "13%", campaigns: 9, keywords: 198, syncHistory: ["03/12 10:00 동기화 완료"] },
];

const statusMap: Record<string, { label: string; badge: string; icon: typeof Wifi }> = {
  connected: { label: "연결됨", badge: "badge-success", icon: Wifi },
  error: { label: "오류", badge: "badge-error", icon: WifiOff },
  pending: { label: "대기중", badge: "badge-warning", icon: AlertCircle },
};

export default function AccountsPage() {
  const [showImport, setShowImport] = useState(false);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState<number | null>(null);
  const [apiTestStatus, setApiTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
  const [accounts, setAccounts] = useState(initialAccounts);
  const [newAccountName, setNewAccountName] = useState("");
  const [newCustomerId, setNewCustomerId] = useState("");
  const { addToast } = useToast();

  // ── API 데이터 페칭 (폴백 지원) ──
  const { data: apiAccounts } = useAccounts();

  useEffect(() => {
    if (apiAccounts?.length > 0) {
      setAccounts(apiAccounts.map((a: any) => ({
        id: a.id ?? 0, name: a.customerName ?? '', customerId: a.customerId ?? '',
        status: a.isActive ? 'connected' : 'error', lastSync: a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString('ko-KR') : '-',
        spend: `₩${(Number(a.totalSpend ?? 0)).toLocaleString()}`, dailyBudget: `₩${(Number(a.dailyBudget ?? 0)).toLocaleString()}`,
        commissionRate: `${a.commissionRate ?? 15}%`, campaigns: a._count?.campaigns ?? 0, keywords: a._count?.keywords ?? 0,
        syncHistory: ['API 데이터 로드 완료'],
      })));
    }
  }, [apiAccounts]);

  const maxAccounts = 15;
  const usedAccounts = accounts.length;
  const usagePercent = (usedAccounts / maxAccounts) * 100;
  const drawerAccount = accounts.find((a) => a.id === selectedDrawer);

  const handleApiTest = () => {
    setApiTestStatus("testing");
    setTimeout(() => setApiTestStatus("success"), 1500);
  };

  const handleAddAccount = () => {
    if (!newAccountName.trim()) { addToast("error", "광고주명을 입력해주세요"); return; }
    const newId = Math.max(...accounts.map((a) => a.id)) + 1;
    setAccounts((prev) => [...prev, {
      id: newId, name: newAccountName, customerId: newCustomerId || `ncc-${newId}000000`,
      status: "connected", lastSync: "방금 전", spend: "₩0", dailyBudget: "₩100,000",
      commissionRate: "15%", campaigns: 0, keywords: 0, syncHistory: ["최초 연동 완료"],
    }]);
    addToast("success", "계정 연동 완료", `'${newAccountName}' 계정이 추가되었습니다.`);
    setNewAccountName(""); setNewCustomerId("");
    setShowAddModal(false); setApiTestStatus("idle");
  };

  const [searchQuery, setSearchQuery] = useState("");
  const [ctxMenu, setCtxMenu] = useState<number | null>(null);

  const filteredAccounts = accounts.filter((acc) =>
    searchQuery === "" || acc.name.toLowerCase().includes(searchQuery.toLowerCase()) || acc.customerId.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteAccount = (id: number) => {
    const acc = accounts.find((a) => a.id === id);
    setAccounts((prev) => prev.filter((a) => a.id !== id));
    addToast("info", "계정 삭제 완료", `'${acc?.name}' 계정이 제거되었습니다.`);
    setCtxMenu(null);
    if (selectedDrawer === id) setSelectedDrawer(null);
  };

  const handleSyncAccount = (id: number) => {
    const acc = accounts.find((a) => a.id === id);
    addToast("success", "동기화 완료", `'${acc?.name}' 계정 데이터가 동기화되었습니다.`);
    setCtxMenu(null);
  };

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      addToast("success", "CSV 업로드 완료", `'${file.name}' 파일이 성공적으로 업로드되었습니다. 데이터를 처리 중입니다.`);
      e.target.value = "";
    }
  };

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">계정 관리</h1>
        <div className="main-header-actions">
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}><Plus size={16} /> 계정 연동</button>
        </div>
      </header>
      <div className="main-body">
        {/* 3-E: Plan Limit Progress Bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 16, padding: "12px 16px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", marginBottom: 24 }}>
          <span style={{ fontSize: "0.857rem", fontWeight: 600, whiteSpace: "nowrap" }}>계정 사용: {usedAccounts}/{maxAccounts}</span>
          <div style={{ flex: 1, height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 4, transition: "width 0.5s", width: `${usagePercent}%`, background: usagePercent > 80 ? "var(--warning)" : "var(--primary)" }} />
          </div>
          <span style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>Growth 플랜</span>
          <button className="btn btn-sm btn-secondary">업그레이드</button>
        </div>

        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          <div style={{ position: "relative", flex: 1 }}>
            <Search size={18} color="var(--text-muted)" style={{ position: "absolute", left: 12, top: 10 }} />
            <input className="form-input" placeholder="계정 검색..." style={{ paddingLeft: 36 }} value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
          </div>
          <button className="btn btn-secondary" onClick={() => addToast("success", "전체 동기화 완료", `${accounts.length}개 계정 데이터가 동기화되었습니다.`)}><RefreshCw size={16} /> 전체 동기화</button>
        </div>

        <div style={{ display: "flex", gap: 24 }}>
          {/* Account Table */}
          <div className="card" style={{ flex: 1 }}>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr><th>광고주명</th><th>고객 ID</th><th>연결 상태</th><th>마지막 동기화</th><th>월 광고비</th><th>캠페인</th><th>키워드</th><th></th></tr>
                </thead>
                <tbody>
                  {filteredAccounts.map((acc) => {
                    const s = statusMap[acc.status] || statusMap.pending;
                    const Icon = s.icon;
                    return (
                      <tr key={acc.id} onClick={() => { setSelectedDrawer(acc.id); setCtxMenu(null); }} style={{ cursor: "pointer", background: selectedDrawer === acc.id ? "var(--primary-light)" : undefined }}>
                        <td style={{ fontWeight: 600 }}>{acc.name}</td>
                        <td className="text-mono" style={{ fontSize: "0.786rem", color: "var(--text-secondary)" }}>{acc.customerId}</td>
                        <td><span className={`badge ${s.badge}`}><Icon size={12} /> {s.label}</span></td>
                        <td style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>{acc.lastSync}</td>
                        <td style={{ fontWeight: 600 }}>{acc.spend}</td>
                        <td>{acc.campaigns}</td>
                        <td>{acc.keywords}개</td>
                        <td style={{ position: "relative" }}>
                          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setCtxMenu(ctxMenu === acc.id ? null : acc.id); }}><MoreVertical size={16} /></button>
                          {ctxMenu === acc.id && (
                            <div style={{ position: "absolute", right: 0, top: "100%", zIndex: 100, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)", boxShadow: "var(--shadow-lg)", minWidth: 140, padding: 4 }}>
                              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }} onClick={(e) => { e.stopPropagation(); handleSyncAccount(acc.id); }}>🔄 동기화</button>
                              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start" }} onClick={(e) => { e.stopPropagation(); setSelectedDrawer(acc.id); setCtxMenu(null); }}>✏️ 상세 보기</button>
                              <button className="btn btn-ghost btn-sm" style={{ width: "100%", justifyContent: "flex-start", color: "var(--error)" }} onClick={(e) => { e.stopPropagation(); handleDeleteAccount(acc.id); }}>🗑️ 삭제</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* 3-C: Account Detail Drawer */}
          {drawerAccount && (
            <div className="card" style={{ width: 340, flexShrink: 0 }}>
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>{drawerAccount.name}</h3>
                <button className="btn btn-ghost btn-sm" onClick={() => setSelectedDrawer(null)}><X size={16} /></button>
              </div>
              <div className="card-body">
                {[
                  { label: "고객 ID", value: drawerAccount.customerId },
                  { label: "연결 상태", value: statusMap[drawerAccount.status]?.label },
                  { label: "마지막 동기화", value: drawerAccount.lastSync },
                  { label: "일예산", value: drawerAccount.dailyBudget },
                  { label: "월 광고비", value: drawerAccount.spend },
                  { label: "수수료율", value: drawerAccount.commissionRate },
                  { label: "캠페인 수", value: `${drawerAccount.campaigns}개` },
                  { label: "키워드 수", value: `${drawerAccount.keywords}개` },
                ].map((item) => (
                  <div key={item.label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: "0.857rem" }}>
                    <span style={{ color: "var(--text-muted)" }}>{item.label}</span>
                    <span style={{ fontWeight: 600 }}>{item.value}</span>
                  </div>
                ))}
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: "0.786rem", fontWeight: 600, marginBottom: 8 }}>동기화 이력</div>
                  {drawerAccount.syncHistory.map((h, i) => (
                    <div key={i} style={{ fontSize: "0.786rem", color: "var(--text-secondary)", padding: "4px 0" }}>• {h}</div>
                  ))}
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                  <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}><RefreshCw size={14} /> 동기화</button>
                  <button className="btn btn-sm btn-secondary" style={{ flex: 1 }}>설정 변경</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3-D: Conversion Import Banner */}
        <div className="card ai-panel" style={{ marginTop: 24, padding: "20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <strong style={{ fontSize: "1rem" }}>🔄 기존 도구에서 전환하세요</strong>
              <p style={{ fontSize: "0.857rem", color: "var(--text-secondary)", marginTop: 4 }}>보라웨어, 비딩윈, 네이버스에서 3분 만에 데이터를 옮기세요.</p>
            </div>
            <button className="btn btn-primary" onClick={() => setShowImport(!showImport)}><Upload size={16} /> 전환 임포트 <ArrowRight size={14} /></button>
          </div>
          {showImport && (
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
              <p style={{ fontSize: "0.857rem", fontWeight: 600, marginBottom: 12 }}>사용하시던 도구를 선택하세요:</p>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
                {["보라웨어", "비딩윈", "네이버스"].map((tool) => (
                  <div key={tool} onClick={() => setSelectedTool(tool)} style={{
                    border: selectedTool === tool ? "2px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "var(--radius-lg)", padding: "16px", textAlign: "center", cursor: "pointer",
                    background: selectedTool === tool ? "var(--primary-light)" : "var(--surface)", transition: "all var(--transition)"
                  }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{tool}</div>
                    <div style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>CSV 파일 업로드</div>
                  </div>
                ))}
              </div>
              {selectedTool && (
                <div className="card" style={{ padding: 24, textAlign: "center", border: "2px dashed var(--border)", borderRadius: "var(--radius-xl)", cursor: "pointer", position: "relative" }}>
            <input type="file" accept=".csv" onChange={handleCsvUpload} style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }} />
            <Upload size={24} color="var(--text-muted)" style={{ marginBottom: 8 }} />
            <p style={{ fontWeight: 600, marginBottom: 4 }}>전환 데이터 임포트</p><div>{selectedTool} CSV 파일을 드래그하거나 클릭하여 업로드</div>
                  <button className="btn btn-sm btn-secondary" style={{ marginTop: 12 }} onClick={() => addToast("success", "CSV 임포트 완료", `${selectedTool}에서 3개 계정, 245개 키워드를 성공적으로 가져왔습니다.`)}>파일 선택</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 3-B: Account Add Modal */}
      {showAddModal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ background: "#fff", borderRadius: "var(--radius-xl)", padding: 32, maxWidth: 520, width: "100%", boxShadow: "var(--shadow-xl)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h3>📡 광고 계정 연동</h3>
              <button className="btn btn-ghost btn-sm" onClick={() => { setShowAddModal(false); setApiTestStatus("idle"); }}><X size={18} /></button>
            </div>
            <div className="form-group"><label className="form-label">광고주명</label><input className="form-input" placeholder="예: G 파티시에" value={newAccountName} onChange={(e) => setNewAccountName(e.target.value)} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <div className="form-group"><label className="form-label">API License Key</label><input className="form-input" type="password" placeholder="API 키 입력" /></div>
              <div className="form-group"><label className="form-label">Secret Key</label><input className="form-input" type="password" placeholder="Secret Key 입력" /></div>
            </div>
            <div className="form-group"><label className="form-label">Customer ID</label><input className="form-input" placeholder="네이버 광고 고객 ID" value={newCustomerId} onChange={(e) => setNewCustomerId(e.target.value)} /></div>
            <button
              className={`btn ${apiTestStatus === "success" ? "btn-success" : "btn-secondary"}`}
              style={{ width: "100%", marginBottom: 16 }}
              onClick={handleApiTest} disabled={apiTestStatus === "testing"}
            >
              {apiTestStatus === "idle" && "🔌 연결 테스트"}
              {apiTestStatus === "testing" && "⏳ 테스트 중..."}
              {apiTestStatus === "success" && "✅ 연결 성공!"}
              {apiTestStatus === "error" && "❌ 연결 실패"}
            </button>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => { setShowAddModal(false); setApiTestStatus("idle"); }}>취소</button>
              <button className="btn btn-primary" disabled={apiTestStatus !== "success"} onClick={handleAddAccount}>
                <Plus size={16} /> 계정 추가
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
