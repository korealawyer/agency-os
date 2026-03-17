'use client';
import { useEffect, useState } from 'react';

export default function ReportsPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/reports').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>📄 리포트 통합 관리</h1>
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 24px' }}>
          <div style={{ fontSize: 12, color: '#888' }}>총 리포트</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#7c5cfc' }}>{data.totalReports}</div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: '16px 24px' }}>
          <div style={{ fontSize: 12, color: '#888' }}>템플릿 수</div>
          <div style={{ fontSize: 24, fontWeight: 700, color: '#38bdf8' }}>{data.templates?.length ?? 0}</div>
        </div>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden', marginBottom: 24 }}>
        <h3 style={{ padding: '16px 20px 8px', margin: 0, fontSize: 15, color: '#fff', fontWeight: 600 }}>최근 리포트</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['제목','조직','템플릿','기간','발송일'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.reports?.map((r: any) => (
            <tr key={r.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px', color: '#e0e0e0' }}>{r.title}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{r.organization?.name}</td>
              <td style={{ padding: '10px 14px', color: '#aaa' }}>{r.template?.name || '-'}</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(r.periodStart).toLocaleDateString('ko-KR')} ~ {new Date(r.periodEnd).toLocaleDateString('ko-KR')}</td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{r.sentAt ? new Date(r.sentAt).toLocaleString('ko-KR') : '미발송'}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
