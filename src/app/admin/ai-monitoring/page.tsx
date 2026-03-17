'use client';
import { useEffect, useState } from 'react';

export default function AiMonitoringPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/ai-monitoring?limit=30').then(r => r.json()).then(r => setData(r)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  const tc = data.data?.[0]?._typeCounts || [];
  const as2 = data.data?.[0]?._approvalStats || [];
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>🤖 AI 액션 통합 모니터링</h1>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        {tc.map((t: any) => (
          <div key={t.actionType} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#c084fc' }}>{t._count}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{t.actionType}</div>
          </div>
        ))}
        {as2.map((a: any) => (
          <div key={String(a.isApproved)} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: a.isApproved === true ? '#4ade80' : a.isApproved === false ? '#f43f5e' : '#f59e0b' }}>{a._count}</div>
            <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>{a.isApproved === true ? '승인' : a.isApproved === false ? '거부' : '대기'}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['유형','조직','사용자','신뢰도','승인','일시'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.data?.map((l: any) => (
            <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(192,132,252,0.15)', color: '#c084fc' }}>{l.actionType}</span></td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{l.organization?.name}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{l.user?.name || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{l.confidence ? `${(Number(l.confidence) * 100).toFixed(0)}%` : '-'}</td>
              <td style={{ padding: '10px 14px' }}><span style={{ color: l.isApproved === true ? '#4ade80' : l.isApproved === false ? '#f43f5e' : '#f59e0b' }}>{l.isApproved === true ? '✅' : l.isApproved === false ? '❌' : '⏳'}</span></td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(l.createdAt).toLocaleString('ko-KR')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p style={{ color: '#666', fontSize: 12, marginTop: 12 }}>총 {data.pagination?.total ?? 0}건</p>
    </div>
  );
}
