'use client';
import { useEffect, useState } from 'react';

export default function AnnouncementsPage() {
  const [data, setData] = useState<any>(null);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const loadData = () => fetch('/api/admin/announcements').then(r => r.json()).then(r => setData(r.data));
  useEffect(() => { loadData(); }, []);

  const sendAnnouncement = async () => {
    if (!title || !message) return;
    setSending(true);
    await fetch('/api/admin/announcements', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, priority: 'normal' }),
    });
    setTitle(''); setMessage('');
    setSending(false);
    loadData();
  };

  if (!data) return <p style={{ color: '#888', padding: 40 }}>로딩 중...</p>;
  return (
    <div>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 24 }}>📢 공지사항</h1>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 20, marginBottom: 24 }}>
        <h3 style={{ color: '#fff', fontSize: 15, fontWeight: 600, margin: '0 0 16px' }}>새 공지 작성</h3>
        <input placeholder="제목" value={title} onChange={e => setTitle(e.target.value)}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#e0e0e0', fontSize: 13, marginBottom: 12, outline: 'none' }} />
        <textarea placeholder="내용" value={message} onChange={e => setMessage(e.target.value)} rows={3}
          style={{ width: '100%', padding: '10px 14px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#e0e0e0', fontSize: 13, marginBottom: 12, outline: 'none', resize: 'vertical' }} />
        <button onClick={sendAnnouncement} disabled={sending || !title || !message}
          style={{ padding: '8px 20px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c5cfc, #c084fc)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer', opacity: sending ? 0.5 : 1 }}>
          {sending ? '발송 중...' : '전체 발송'}
        </button>
      </div>
      <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            {['제목','내용','우선순위','발송일'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: '#888', fontWeight: 500 }}>{h}</th>)}
          </tr></thead>
          <tbody>{data.notifications?.map((n: any) => (
            <tr key={n.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
              <td style={{ padding: '10px 14px', color: '#e0e0e0', fontWeight: 500 }}>{n.title}</td>
              <td style={{ padding: '10px 14px', color: '#aaa', maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.message}</td>
              <td style={{ padding: '10px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, background: 'rgba(124,92,252,0.15)', color: '#c084fc' }}>{n.priority}</span></td>
              <td style={{ padding: '10px 14px', color: '#888' }}>{new Date(n.createdAt).toLocaleString('ko-KR')}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
