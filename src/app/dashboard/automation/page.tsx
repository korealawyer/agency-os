"use client";

import { useState } from "react";
import { Zap, Shield, Clock, Target, DollarSign, TrendingUp, BarChart3, AlertTriangle, CheckCircle2, X, RefreshCw } from "lucide-react";
import { useToast } from "@/components/Toast";
import { useAccounts, useAiActions, apiMutate } from "@/hooks/useApi";

type ConfirmMode = "semi" | "full" | "manual";

const strategies = [
  { key: "target_rank", label: "목표 순위", icon: Target, desc: "1~3위 유지. AI가 실시간 입찰가 자동 조정", active: 0, color: "#1E40AF" },
  { key: "target_cpc", label: "목표 CPC", icon: DollarSign, desc: "클릭당 500원 이하. 해당 CPC로 최대 순위 확보", active: 0, color: "#10B981" },
  { key: "target_roas", label: "목표 ROAS", icon: TrendingUp, desc: "투자 대비 300% 수익. 전환 데이터 기반 최적화", active: 0, color: "#7C3AED" },
  { key: "max_conversion", label: "최대 전환", icon: BarChart3, desc: "예산 내 전환 수 극대화. AI가 입찰가·시간대 자동 최적화", active: 0, color: "#F59E0B" },
  { key: "time_based", label: "시간대 차등", icon: Clock, desc: "09~18시 공격적, 야간 보수적. 시간대별 자동 조정", active: 0, color: "#EC4899" },
  { key: "manual", label: "수동", icon: Shield, desc: "사용자가 직접 입찰가 설정. AI 추천만 제공", active: 0, color: "#94A3B8" },
];

const executionLogs: { time: string; user: string; target: string; action: string; result: string }[] = [];

export default function AutomationPage() {
  const [confirmMode, setConfirmMode] = useState<ConfirmMode>("semi");
  const [showModal, setShowModal] = useState(false);
  const [pendingMode, setPendingMode] = useState<ConfirmMode>("semi");
  const [safetyValues, setSafetyValues] = useState({
    dailyBudget: 100, bidMax: 10000, bidMin: 70, speedLimit: true,
  });
  const [selectedStrategy, setSelectedStrategy] = useState("target_rank");
  const [isApplying, setIsApplying] = useState(false);
  const { addToast } = useToast();
  const { data: accountsData } = useAccounts(1, 100);
  const { data: aiActionsData, mutate: mutateActions } = useAiActions(1, 30);
  const accountsList = Array.isArray(accountsData) ? accountsData : (accountsData?.data ?? []);
  const accountNames = accountsList.map((a: any) => a.customerName || a.name).filter(Boolean);
  const displayAccounts = accountNames.length > 0 ? accountNames : ['계정을 동기화해주세요'];
  const dbLogs = Array.isArray(aiActionsData) ? aiActionsData : [];

  const handleModeChange = (mode: ConfirmMode) => {
    if (mode === "full") {
      setPendingMode(mode);
      setShowModal(true);
    } else {
      setConfirmMode(mode);
    }
  };

  const confirmModes = [
    { key: "semi" as const, label: "Semi Auto", desc: "AI 추천 → 사용자 최종 승인 (권장)", badge: "권장" },
    { key: "full" as const, label: "Full Auto", desc: "AI 판단 → 즉시 실행 (예산 한도 내)", badge: "⚠️" },
    { key: "manual" as const, label: "Manual", desc: "모든 변경을 사용자가 직접 실행", badge: "" },
  ];

  return (
    <>
      <header className="main-header">
        <h1 className="main-header-title">자동화 설정</h1>
      </header>
      <div className="main-body">
        {/* 6-C: Confirm Mode Toggle */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Shield size={18} /> 컨펌 모드</h3>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {confirmModes.map((m) => (
                <div
                  key={m.key}
                  onClick={() => handleModeChange(m.key)}
                  style={{
                    border: confirmMode === m.key ? "2px solid var(--primary)" : "1px solid var(--border)",
                    borderRadius: "var(--radius-xl)", padding: 20,
                    background: confirmMode === m.key ? "var(--primary-light)" : "var(--surface)",
                    cursor: "pointer", transition: "all var(--transition)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                    <strong>{m.label}</strong>
                    {m.badge && m.key === "full" ? (
                      <span className="info-tooltip">
                        <span className={`badge badge-warning`}>{m.badge}</span>
                        <span className="tooltip-text">AI가 예산 한도 내에서 24시간 자동으로 입찰가를 조정합니다. 일예산 초과 시 자동 중단되며, 안전장치(상하한/속도 제한) 범위 내에서만 실행됩니다. 언제든 Semi Auto로 전환 가능합니다.</span>
                      </span>
                    ) : m.badge ? (
                      <span className={`badge badge-info`}>{m.badge}</span>
                    ) : null}
                  </div>
                  <p style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{m.desc}</p>
                  <div style={{
                    marginTop: 12, width: 40, height: 22, borderRadius: 12, padding: 2,
                    background: confirmMode === m.key ? "var(--primary)" : "var(--border)", transition: "all 0.3s",
                    position: "relative", cursor: "pointer",
                  }}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      transform: confirmMode === m.key ? "translateX(18px)" : "translateX(0)",
                      transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Active Strategy Summary */}
        <div style={{ display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
          {strategies.map(s => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", background: "var(--surface)", border: `1px solid ${selectedStrategy === s.key ? s.color : "var(--border)"}`, borderRadius: "var(--radius-lg)", fontSize: "0.857rem", cursor: "pointer", transition: "all var(--transition)" }} onClick={() => setSelectedStrategy(s.key)}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: s.color }} />
              <span style={{ fontWeight: selectedStrategy === s.key ? 600 : 400 }}>{s.label}</span>
              <span style={{ color: "var(--text-muted)", fontSize: "0.786rem" }}>{s.active}개</span>
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: "0.857rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: 4 }}>
            총 <strong style={{ color: "var(--text-primary)" }}>{strategies.reduce((s, st) => s + st.active, 0).toLocaleString()}</strong>개 키워드 관리 중
          </div>
        </div>

        {/* Bid Strategies */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Zap size={18} /> 입찰 전략 (6가지)</h3>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
              {strategies.map((s) => {
                const Icon = s.icon;
                const isSelected = selectedStrategy === s.key;
                return (
                  <div
                    key={s.key}
                    onClick={() => setSelectedStrategy(s.key)}
                    className="card"
                    style={{
                      border: isSelected ? `2px solid ${s.color}` : "1px solid var(--border)",
                      padding: 20, cursor: "pointer", transition: "all var(--transition)",
                      background: isSelected ? `${s.color}08` : undefined,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "var(--radius-lg)", background: `${s.color}15`, color: s.color, display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <Icon size={20} />
                      </div>
                      <div>
                        <strong>{s.label}</strong>
                        <div style={{ fontSize: "0.786rem", color: "var(--text-muted)" }}>{s.active}개 키워드</div>
                      </div>
                    </div>
                    <p style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>{s.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 6-B: Strategy Parameter Form (selected strategy) */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3>⚙️ {strategies.find((s) => s.key === selectedStrategy)?.label} — 상세 설정</h3>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {selectedStrategy === "target_rank" && (<>
                <div className="form-group"><label className="form-label">목표 순위</label><input className="form-input" type="number" defaultValue={3} min={1} max={10} /><div style={{ fontSize: "0.714rem", color: "var(--text-muted)" }}>1~10위 설정</div></div>
                <div className="form-group"><label className="form-label">목표 달성 시 유지 방식</label><select className="form-input"><option>최대한 유지</option><option>예산 우선</option></select></div>
              </>)}
              {selectedStrategy === "target_cpc" && (<>
                <div className="form-group"><label className="form-label">목표 CPC (₩)</label><input className="form-input" type="number" defaultValue={500} step={50} /></div>
                <div className="form-group"><label className="form-label">허용 편차 (%)</label><input className="form-input" type="number" defaultValue={10} /></div>
              </>)}
              {selectedStrategy === "target_roas" && (<>
                <div className="form-group"><label className="form-label">목표 ROAS (%)</label><input className="form-input" type="number" defaultValue={300} step={10} /></div>
                <div className="form-group"><label className="form-label">전환 추적 기간</label><select className="form-input"><option>7일</option><option>14일</option><option>30일</option></select></div>
              </>)}
              {selectedStrategy === "max_conversion" && (<>
                <div className="form-group"><label className="form-label">일예산 상한</label><input className="form-input" type="number" defaultValue={500000} step={10000} /></div>
                <div className="form-group"><label className="form-label">최적화 대상</label><select className="form-input"><option>전환 수</option><option>전환 가치</option></select></div>
              </>)}
              {selectedStrategy === "time_based" && (<>
                <div className="form-group"><label className="form-label">공격 시간대</label><input className="form-input" defaultValue="09:00 ~ 18:00" /></div>
                <div className="form-group"><label className="form-label">공격 배율 (%)</label><input className="form-input" type="number" defaultValue={120} /></div>
              </>)}
              {selectedStrategy === "manual" && (
                <div className="form-group" style={{ gridColumn: "1 / -1" }}><p style={{ color: "var(--text-secondary)", fontSize: "0.857rem" }}>수동 모드에서는 사용자가 직접 입찰가를 설정합니다. AI는 추천만 제공합니다.</p></div>
              )}
            </div>
          </div>
        </div>

        {/* 6-E: Apply Target Selection */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Target size={18} /> 적용 대상 선택</h3>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
              {displayAccounts.map((acc: string) => (
                <label key={acc} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 14px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", cursor: "pointer", fontSize: "0.857rem" }}>
                  <input type="checkbox" defaultChecked /> {acc}
                </label>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                className="btn btn-primary"
                disabled={isApplying}
                onClick={async () => {
                  setIsApplying(true);
                  const strategyLabel = strategies.find(s => s.key === selectedStrategy)?.label ?? selectedStrategy;
                  try {
                    await apiMutate('/api/copilot/actions', {
                      method: 'POST',
                      body: JSON.stringify({
                        actionType: 'bid_adjustment',
                        entityType: 'automation',
                        inputData: {
                          strategy: selectedStrategy,
                          confirmMode,
                          accounts: accountNames,
                          safetyValues,
                        },
                        outputData: { applied: true, strategyLabel },
                        confidence: 0.85,
                      }),
                    });
                    await mutateActions();
                    addToast('success', '전략 적용 완료', `${strategyLabel} 전략이 선택된 계정에 적용되었습니다.`);
                  } catch (err: any) {
                    addToast('error', '적용 실패', err?.message ?? '서버 오류가 발생했습니다.');
                  }
                  setIsApplying(false);
                }}
              >
                {isApplying ? <><RefreshCw size={14} style={{ animation: 'spin 1s linear infinite' }} /> 적용 중...</> : '선택 계정에 적용'}
              </button>
              <button className="btn btn-secondary">전체 선택</button>
              <button className="btn btn-secondary">전체 해제</button>
            </div>
          </div>
        </div>
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><AlertTriangle size={18} color="var(--warning)" /> 안전장치</h3>
          </div>
          <div className="card-body">
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 24 }}>
              <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div><div style={{ fontWeight: 600 }}>일예산 상한</div><div style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>설정값 초과 시 입찰 중단</div></div>
                  <span className="badge badge-success">{safetyValues.dailyBudget}%</span>
                </div>
                <input type="range" min={50} max={200} value={safetyValues.dailyBudget} onChange={(e) => setSafetyValues({ ...safetyValues, dailyBudget: +e.target.value })}
                  style={{ width: "100%", accentColor: "var(--primary)" }} />
              </div>
              <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div><div style={{ fontWeight: 600 }}>입찰가 상한</div><div style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>키워드당 최대 입찰가 제한</div></div>
                  <span className="badge badge-success">₩{safetyValues.bidMax.toLocaleString()}</span>
                </div>
                <input type="range" min={1000} max={50000} step={500} value={safetyValues.bidMax} onChange={(e) => setSafetyValues({ ...safetyValues, bidMax: +e.target.value })}
                  style={{ width: "100%", accentColor: "var(--primary)" }} />
              </div>
              <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <div><div style={{ fontWeight: 600 }}>입찰가 하한</div><div style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>키워드당 최소 입찰가 보장</div></div>
                  <span className="badge badge-success">₩{safetyValues.bidMin}</span>
                </div>
                <input type="range" min={50} max={500} step={10} value={safetyValues.bidMin} onChange={(e) => setSafetyValues({ ...safetyValues, bidMin: +e.target.value })}
                  style={{ width: "100%", accentColor: "var(--primary)" }} />
              </div>
              <div style={{ padding: "16px 0", borderBottom: "1px solid var(--border)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div><div style={{ fontWeight: 600 }}>변경 속도 제한</div><div style={{ fontSize: "0.857rem", color: "var(--text-secondary)" }}>1회 ±50원 / 1시간 최대 3회</div></div>
                  <div style={{
                    width: 40, height: 22, borderRadius: 12, padding: 2,
                    background: safetyValues.speedLimit ? "var(--primary)" : "var(--border)", transition: "all 0.3s",
                    cursor: "pointer", position: "relative",
                  }} onClick={() => setSafetyValues({ ...safetyValues, speedLimit: !safetyValues.speedLimit })}>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%", background: "#fff",
                      transform: safetyValues.speedLimit ? "translateX(18px)" : "translateX(0)",
                      transition: "transform 0.3s", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                    }} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* 6-F: Execution History */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}><Clock size={18} /> 실행 이력</h3>
          </div>
          <div className="table-wrapper">
            <table>
              <thead><tr><th>시간</th><th>유형</th><th>전략</th><th>계정수</th><th>상태</th></tr></thead>
              <tbody>
                {dbLogs.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontSize: '0.929rem' }}>
                    <Clock size={28} color="var(--border)" style={{ display: 'block', margin: '0 auto 10px' }} />
                    아직 실행된 자동화 이력이 없습니다
                  </td></tr>
                ) : dbLogs.map((log: any) => {
                  const strategyLabel = log.inputData?.strategyLabel ?? log.inputData?.strategy ?? log.actionType;
                  const accCount = Array.isArray(log.inputData?.accounts) ? log.inputData.accounts.length : '-';
                  const ts = new Date(log.createdAt).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={log.id}>
                      <td style={{ fontSize: '0.857rem', color: 'var(--text-secondary)' }}>{ts}</td>
                      <td><span className="badge badge-info">{log.isApproved ? 'AI 실행' : '대기'}</span></td>
                      <td style={{ fontWeight: 500 }}>{strategyLabel}</td>
                      <td>{accCount}</td>
                      <td><span className="badge badge-success"><CheckCircle2 size={12} /> 적용됨</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Full Auto Confirmation Modal */}
      {showModal && (
        <div style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex",
          alignItems: "center", justifyContent: "center", zIndex: 1000,
        }}>
          <div style={{
            background: "var(--bg-card, var(--surface))", borderRadius: "var(--radius-xl)", padding: 32,
            maxWidth: 480, width: "100%", boxShadow: "var(--shadow-xl)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <AlertTriangle size={20} color="var(--warning)" /> Full Auto 모드 활성화
              </h3>
              <button className="btn btn-ghost btn-sm" onClick={() => setShowModal(false)}><X size={18} /></button>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: 24, lineHeight: 1.6 }}>
              Full Auto 모드를 활성화하면 AI가 입찰가를 자동으로 조정합니다.<br />
              안전장치(일예산 상한, 입찰가 상하한, 속도 제한) 범위 내에서만 실행됩니다.
            </p>
            <div style={{ background: "#FEF3C7", border: "1px solid #F59E0B", borderRadius: "var(--radius-lg)", padding: 12, marginBottom: 24 }}>
              <strong style={{ color: "#92400E" }}>⚠️ 주의사항</strong>
              <ul style={{ fontSize: "0.857rem", color: "#92400E", margin: "8px 0 0 16px", lineHeight: 1.8 }}>
                <li>사전 승인 없이 입찰가가 변경됩니다</li>
                <li>안전장치 설정을 먼저 확인해주세요</li>
                <li>언제든 Semi Auto로 전환 가능합니다</li>
              </ul>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setShowModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={() => { setConfirmMode(pendingMode); setShowModal(false); }}>
                Full Auto 활성화
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
