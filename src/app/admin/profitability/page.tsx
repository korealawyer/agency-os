'use client';
import { useEffect, useState } from 'react';

export default function ProfitabilityPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/profitability').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  const t = data.totals?._sum || {};
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>💰 수익성 통합 관리</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[{ l: '총 광고비', v: t.adSpend, c: '#f59e0b' }, { l: '총 수수료', v: t.agencyFee, c: '#7c5cfc' }, { l: '총 순이익', v: t.netProfit, c: '#4ade80' }, { l: '총 인건비', v: t.laborCost, c: '#f43f5e' }].map(k => (
          <div key={k.l} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#888' }}>{k.l}</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: k.c, marginTop: 4 }}>₩{Number(k.v || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <h3 style={{ padding: '16px 20px 8px', margin: 0, fontSize: 15, color: '#fff', fontWeight: 600 }}>수익 상세</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['조직','광고주','광고비','수수료','순이익','마진율','기간'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.profitability?.map((p: any) => (
            <tr key={p.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px', color: '#e0e0e0' }}>{p.organization?.name}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{p.naverAccount?.customerName}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>₩{Number(p.adSpend).toLocaleString()}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>₩{Number(p.agencyFee).toLocaleString()}</td>
              <td style={{ padding: '10px 14px', color: Number(p.netProfit) >= 0 ? '#4ade80' : '#f43f5e' }}>₩{Number(p.netProfit).toLocaleString()}</td>
              <td style={{ padding: '10px 14px', color: Number(p.marginRate) >= 0 ? '#4ade80' : '#f43f5e' }}>{(Number(p.marginRate) * 100).toFixed(1)}%</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(p.period).toLocaleDateString('ko-KR')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
