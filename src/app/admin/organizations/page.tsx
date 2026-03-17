'use client';
import { useEffect, useState } from 'react';
import { Building2, Search } from 'lucide-react';

export default function OrganizationsPage() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/organizations?search=${search}&limit=50`)
      .then(r => r.json()).then(r => setData(r)).catch(() => {}).finally(() => setLoading(false));
  }, [search]);

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>🏢 조직 관리</h1>
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: '#888' }} />
          <input placeholder="조직명 검색..." value={search} onChange={e => { setSearch(e.target.value); setLoading(true); }}
            style={{ width: '100%', padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#e0e0e0', fontSize: 13, outline: 'none' }} />
        </div>
      </div>
      {loading ? <p style={{ color: '#888' }}>로딩 중...</p> : (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['조직명','플랜','멤버','계정','상태','생성일'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data?.data?.map((org: any) => (
                <tr key={org.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '10px 14px', color: '#e0e0e0', fontWeight: 500 }}>{org.name}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(124,92,252,0.15)', color: '#c084fc' }}>{org.planType}</span></td>
                  <td style={{ padding: '10px 14px', color: '#aaa' }}>{org._count?.users ?? 0}</td>
                  <td style={{ padding: '10px 14px', color: '#aaa' }}>{org._count?.naverAccounts ?? 0}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ color: org.isActive ? '#4ade80' : '#f43f5e' }}>{org.isActive ? '활성' : '비활성'}</span></td>
                  <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(org.createdAt).toLocaleDateString('ko-KR')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ color: '#666', fontSize: 12, marginTop: 12 }}>총 {data?.pagination?.total ?? 0}개 조직</p>
    </div>
  );
}
