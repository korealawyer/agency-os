'use client';
import { useEffect, useState } from 'react';

export default function SecurityPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/security').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>🔐 보안 대시보드</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#888' }}>총 로그인 시도</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#38bdf8', marginTop: 4 }}>{data.loginAttempts}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <div style={{ fontSize: 12, color: '#888' }}>30일 미접속 사용자</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#f59e0b', marginTop: 4 }}>{data.inactiveUsers}</div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <h3 style={{ padding: '16px 20px 8px', margin: 0, fontSize: 15, fontWeight: 600, color: '#fff' }}>최근 로그인 이력</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['사용자','이메일','조직','시간'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.recentLogins?.map((l: any) => (
            <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px', color: '#e0e0e0' }}>{l.user?.name || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{l.user?.email || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{l.organization?.name}</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(l.createdAt).toLocaleString('ko-KR')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
