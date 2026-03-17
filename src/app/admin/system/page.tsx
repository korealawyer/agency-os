'use client';
import { useEffect, useState } from 'react';

export default function SystemPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/system').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>🖥️ 시스템 상태</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>데이터베이스</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: data.database?.status === 'healthy' ? '#4ade80' : '#f43f5e' }} />
            <span style={{ color: data.database?.status === 'healthy' ? '#4ade80' : '#f43f5e', fontSize: 13 }}>{data.database?.status === 'healthy' ? '정상' : '오류'}</span>
          </div>
          {Object.entries(data.counts || {}).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', padding: '4px 0' }}>
              <span>{k}</span><span style={{ color: '#e0e0e0' }}>{String(v)}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>환경 설정</h3>
          {Object.entries(data.environment || {}).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#888', padding: '4px 0' }}>
              <span>{k}</span>
              <span style={{ color: v === true ? '#4ade80' : v === false ? '#f43f5e' : '#e0e0e0' }}>{typeof v === 'boolean' ? (v ? '✅' : '❌') : String(v)}</span>
            </div>
          ))}
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
          <h3 style={{ color: '#fff', fontSize: 14, fontWeight: 600, margin: '0 0 12px' }}>서버 정보</h3>
          <div style={{ fontSize: 12, color: '#888' }}>마지막 확인: {data.timestamp ? new Date(data.timestamp).toLocaleString('ko-KR') : '-'}</div>
        </div>
      </div>
    </div>
  );
}
