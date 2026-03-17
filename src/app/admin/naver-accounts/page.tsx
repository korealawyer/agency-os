'use client';
import { useEffect, useState } from 'react';

export default function NaverAccountsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/naver-accounts').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  const sc: Record<string, string> = { connected: '#4ade80', disconnected: '#f43f5e', error: '#f59e0b', pending: '#888' };
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>🔗 네이버 계정 통합 관리</h1>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {data.statusCounts?.map((s: any) => (
          <div key={s.connectionStatus} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: sc[s.connectionStatus] || '#888' }}>{s._count}</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{s.connectionStatus}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['광고주','조직','상태','월 광고비','수수료율','마지막 동기화'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.accounts?.map((a: any) => (
            <tr key={a.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px', color: '#e0e0e0', fontWeight: 500 }}>{a.customerName}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{a.organization?.name}</td>
              <td style={{ padding: '10px 14px' }}><span style={{ color: sc[a.connectionStatus] || '#888' }}>{a.connectionStatus}</span></td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>₩{Number(a.monthlySpend).toLocaleString()}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{a.commissionRate ? `${(Number(a.commissionRate) * 100).toFixed(1)}%` : '-'}</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString('ko-KR') : '없음'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
