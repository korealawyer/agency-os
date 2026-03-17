'use client';
import { useEffect, useState } from 'react';

export default function AuditPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/audit?limit=50').then(r => r.json()).then(r => setData(r)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  const ac: Record<string, string> = { CREATE: '#4ade80', UPDATE: '#38bdf8', DELETE: '#f43f5e', LOGIN: '#7c5cfc', EXPORT: '#f59e0b' };
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>📋 감사 로그</h1>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['액션','대상','사용자','조직','시간'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.data?.map((l: any) => (
            <tr key={l.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: `${ac[l.action] || '#888'}20`, color: ac[l.action] || '#888' }}>{l.action}</span></td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{l.entityType}{l.entityId ? ` #${l.entityId.substring(0, 8)}` : ''}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{l.user?.name || 'System'}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{l.organization?.name}</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(l.createdAt).toLocaleString('ko-KR')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      <p style={{ color: '#666', fontSize: 12, marginTop: 12 }}>총 {data.pagination?.total ?? 0}건</p>
    </div>
  );
}
