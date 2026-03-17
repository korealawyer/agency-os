'use client';
import { useEffect, useState } from 'react';

export default function SubscriptionsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/subscriptions').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>💳 구독 관리</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#888' }}>총 MRR</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#4ade80', marginTop: 4 }}>₩{Number(data.mrr).toLocaleString()}</div>
        </div>
        {data.planDistribution?.map((p: any) => (
          <div key={p.planType} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 12, color: '#888' }}>{p.planType}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', marginTop: 4 }}>{p._count}건</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['조직명','플랜','상태','월 가격','시작일','종료일'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.subscriptions?.map((s: any) => (
            <tr key={s.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px', color: '#e0e0e0' }}>{s.organization?.name}</td>
              <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(124,92,252,0.15)', color: '#c084fc' }}>{s.planType}</span></td>
              <td style={{ padding: '10px 14px' }}><span style={{ color: s.status === 'active' ? '#4ade80' : '#f59e0b' }}>{s.status}</span></td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>₩{s.monthlyPrice?.toLocaleString()}</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(s.currentPeriodStart).toLocaleDateString('ko-KR')}</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(s.currentPeriodEnd).toLocaleDateString('ko-KR')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
