'use client';
import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

export default function UsersPage() {
  const [data, setData] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/admin/users?search=${search}&limit=50`)
      .then(r => r.json()).then(r => setData(r)).catch(() => {}).finally(() => setLoading(false));
  }, [search]);

  const roleColors: Record<string, string> = { super_admin: '#f43f5e', owner: '#7c5cfc', admin: '#38bdf8', editor: '#4ade80', viewer: '#888' };

  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>👥 사용자 관리</h1>
      <div style={{ marginBottom: 20, position: 'relative' }}>
        <Search size={14} style={{ position: 'absolute', left: 12, top: 10, color: '#888' }} />
        <input placeholder="이름 또는 이메일 검색..." value={search} onChange={e => { setSearch(e.target.value); setLoading(true); }}
          style={{ width: '100%', maxWidth: 400, padding: '8px 12px 8px 32px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#e0e0e0', fontSize: 13, outline: 'none' }} />
      </div>
      {loading ? <p style={{ color: '#888' }}>로딩 중...</p> : (
        <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              {['이름','이메일','조직','역할','상태','마지막 로그인'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
            </tr></thead>
            <tbody>
              {data?.data?.map((u: any) => (
                <tr key={u.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                  <td style={{ padding: '10px 14px', color: '#e0e0e0', fontWeight: 500 }}>{u.name}</td>
                  <td style={{ padding: '10px 14px', color: '#aaa' }}>{u.email}</td>
                  <td style={{ padding: '10px 14px', color: '#aaa' }}>{u.organization?.name}</td>
                  <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: `${roleColors[u.role] || '#888'}20`, color: roleColors[u.role] || '#888' }}>{u.role}</span></td>
                  <td style={{ padding: '10px 14px' }}><span style={{ color: u.isActive ? '#4ade80' : '#f43f5e' }}>{u.isActive ? '활성' : '비활성'}</span></td>
                  <td style={{ padding: '10px 14px', color: '#888' }}>{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('ko-KR') : '없음'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p style={{ color: '#666', fontSize: 12, marginTop: 12 }}>총 {data?.pagination?.total ?? 0}명</p>
    </div>
  );
}
