'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import AdminSidebar from '@/components/AdminSidebar';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/admin/overview');
        if (res.status === 401 || res.status === 403) {
          router.replace('/dashboard');
          return;
        }
        setAuthorized(true);
      } catch {
        router.replace('/dashboard');
      } finally {
        setLoading(false);
      }
    }
    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100vh', background: '#0a0a0f', color: '#888',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: 40, height: 40, border: '3px solid #333', borderTop: '3px solid #7c5cfc',
            borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 16px',
          }} />
          <p>관리자 인증 확인 중...</p>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!authorized) return null;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0f' }}>
      <AdminSidebar />
      <main style={{
        flex: 1, marginLeft: 260, padding: '24px 32px',
        color: '#e0e0e0', overflow: 'auto',
      }}>
        {children}
      </main>
    </div>
  );
}
