'use client';
import { useEffect, useState } from 'react';

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/analytics').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>📈 플랫폼 분석</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {[
          { l: 'MRR', v: `₩${Number(data.mrr).toLocaleString()}`, c: '#4ade80' },
          { l: 'ARR', v: `₩${Number(data.arr).toLocaleString()}`, c: '#7c5cfc' },
          { l: '이탈율', v: `${data.churnRate}%`, c: data.churnRate > 5 ? '#f43f5e' : '#4ade80' },
          { l: '신규 가입 (30일)', v: data.newOrgsThisMonth, c: '#38bdf8' },
          { l: '취소 (30일)', v: data.canceledThisMonth, c: '#f59e0b' },
          { l: '활성 구독', v: data.totalActiveSubscriptions, c: '#10b981' },
        ].map(k => (
          <div key={k.l} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#888' }}>{k.l}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.c, marginTop: 4 }}>{k.v}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>플랜별 수익 분석</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['플랜','활성 구독','MRR 기여'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.planConversions?.map((p: any) => (
            <tr key={p.planType} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(124,92,252,0.15)', color: '#c084fc' }}>{p.planType}</span></td>
              <td style={{ padding: '10px 14px', color: '#e0e0e0' }}>{p._count}건</td>
              <td style={{ padding: '10px 14px', color: '#4ade80' }}>₩{(p._sum?.monthlyPrice || 0).toLocaleString()}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
