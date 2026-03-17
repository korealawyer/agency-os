'use client';
import { useEffect, useState } from 'react';

export default function ClickFraudPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/click-fraud').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>🛡️ 부정클릭 통합 모니터링</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#888' }}>총 이벤트</div><div style={{ fontSize: 24, fontWeight: 700, color: '#f43f5e' }}>{data.totalEvents}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#888' }}>확인됨</div><div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b' }}>{data.confirmedEvents}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#888' }}>차단 IP</div><div style={{ fontSize: 24, fontWeight: 700, color: '#7c5cfc' }}>{data.blockedIps?.length ?? 0}</div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['조직','광고주','IP해시','점수','상태','시간'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.recentEvents?.map((e: any) => (
            <tr key={e.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px', color: '#e0e0e0' }}>{e.organization?.name}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{e.naverAccount?.customerName}</td>
              <td style={{ padding: '10px 14px', color: '#888', fontFamily: 'monospace', fontSize: 11 }}>{e.ipHash?.substring(0, 12)}...</td>
              <td style={{ padding: '10px 14px', color: Number(e.fraudScore) >= 0.8 ? '#f43f5e' : Number(e.fraudScore) >= 0.5 ? '#f59e0b' : '#4ade80' }}>{(Number(e.fraudScore) * 100).toFixed(0)}%</td>
              <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: e.status === 'confirmed' ? 'rgba(244,63,94,0.15)' : 'rgba(245,158,11,0.15)', color: e.status === 'confirmed' ? '#f43f5e' : '#f59e0b' }}>{e.status}</span></td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(e.createdAt).toLocaleString('ko-KR')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
