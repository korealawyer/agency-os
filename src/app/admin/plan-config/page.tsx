'use client';
import { useEffect, useState } from 'react';

export default function PlanConfigPage() {
  const [data, setData] = useState<any>(null);
  useEffect(() => { fetch('/api/admin/plan-config').then(r => r.json()).then(r => setData(r.data)); }, []);
  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  const pc: Record<string, string> = { personal: '#888', starter: '#38bdf8', growth: '#4ade80', scale: '#f59e0b', enterprise: '#7c5cfc' };
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>⚙️ 플랜별 기능 설정</h1>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        {data.planDistribution?.map((p: any) => (
          <div key={p.planType} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 600, color: pc[p.planType] || '#888', marginBottom: 4 }}>{p.planType}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{p._count}건</div>
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>MRR: ₩{(p._sum?.monthlyPrice || 0).toLocaleString()}</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20 }}>
        <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>플랜별 AI 기능 한도</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['기능','Personal','Starter','Growth','Scale','Enterprise'].map(h => <th key={h} style={{ textAlign: 'center', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {[
              ['코파일럿 채팅', '5회/일', '30회/일', '무제한', '무제한', '무제한'],
              ['자동 입찰', '❌', 'Semi만', 'Full', 'Full', 'Full'],
              ['부정클릭 AI', '❌', '기본', '상세', '상세', '상세+'],
              ['AI 리포트', '❌', '월 1회', '주 1회', '무제한', '무제한'],
              ['소재 AI', '❌', '❌', '5회/월', '무제한', '무제한'],
              ['키워드 추천', '❌', '월 1회', '주 1회', '무제한', '무제한'],
            ].map(row => (
              <tr key={row[0]} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                {row.map((cell, i) => (
                  <td key={i} style={{ textAlign: i === 0 ? 'left' : 'center', padding: '10px 14px', color: cell === '❌' ? '#f43f5e' : cell === '무제한' ? '#4ade80' : '#e0e0e0' }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
