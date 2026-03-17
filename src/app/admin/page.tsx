'use client';

import { useEffect, useState } from 'react';
import { Building2, Users, CreditCard, Link2, Bot, ShieldAlert, TrendingUp, DollarSign } from 'lucide-react';

interface KpiData {
  totalOrgs: number; activeOrgs: number;
  totalUsers: number; activeUsers: number;
  mrr: number; totalSubscriptions: number;
  totalNaverAccounts: number; connectedAccounts: number;
  totalAdSpend: number;
  aiActionCount: number; aiApprovalRate: number;
  totalFraudEvents: number;
}

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: string | number; sub?: string; color: string;
}) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 12, padding: '20px 24px',
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{
          width: 32, height: 32, borderRadius: 8,
          background: `${color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Icon size={16} style={{ color }} />
        </div>
        <span style={{ fontSize: 12, color: '#888' }}>{label}</span>
      </div>
      <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: '#666' }}>{sub}</div>}
    </div>
  );
}

export default function AdminHomePage() {
  const [data, setData] = useState<{ kpi: KpiData; recentOrgs: any[] } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/admin/overview')
      .then(r => r.json())
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: '#888', padding: 40 }}>로딩 중...</div>;
  if (!data) return <div style={{ color: '#f66', padding: 40 }}>데이터를 불러올 수 없습니다.</div>;

  const { kpi, recentOrgs } = data;

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>🛡️ 시스템 관리자 대시보드</h1>
        <p style={{ color: '#888', fontSize: 14, marginTop: 4 }}>플랫폼 전체 현황을 한눈에 확인합니다.</p>
      </div>

      {/* KPI Grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 16, marginBottom: 32,
      }}>
        <KpiCard icon={Building2} label="총 조직" value={kpi.totalOrgs} sub={`활성: ${kpi.activeOrgs}`} color="#7c5cfc" />
        <KpiCard icon={Users} label="총 사용자" value={kpi.totalUsers} sub={`활성: ${kpi.activeUsers}`} color="#38bdf8" />
        <KpiCard icon={DollarSign} label="MRR" value={`₩${kpi.mrr.toLocaleString()}`} sub={`구독 ${kpi.totalSubscriptions}건`} color="#4ade80" />
        <KpiCard icon={CreditCard} label="총 광고비" value={`₩${Number(kpi.totalAdSpend).toLocaleString()}`} color="#f59e0b" />
        <KpiCard icon={Link2} label="네이버 계정" value={kpi.totalNaverAccounts} sub={`연결: ${kpi.connectedAccounts}`} color="#06b6d4" />
        <KpiCard icon={Bot} label="AI 액션" value={kpi.aiActionCount} sub={`승인율: ${kpi.aiApprovalRate}%`} color="#c084fc" />
        <KpiCard icon={ShieldAlert} label="부정클릭 탐지" value={kpi.totalFraudEvents} color="#f43f5e" />
        <KpiCard icon={TrendingUp} label="활성 구독" value={kpi.totalSubscriptions} color="#10b981" />
      </div>

      {/* Recent Orgs */}
      <div style={{
        background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
        borderRadius: 12, padding: 24,
      }}>
        <h3 style={{ color: '#fff', fontSize: 16, fontWeight: 600, marginBottom: 16, margin: '0 0 16px' }}>
          최근 가입 조직
        </h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 500 }}>조직명</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 500 }}>플랜</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 500 }}>상태</th>
              <th style={{ textAlign: 'left', padding: '8px 12px', color: '#888', fontWeight: 500 }}>가입일</th>
            </tr>
          </thead>
          <tbody>
            {recentOrgs.map((org: any) => (
              <tr key={org.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '10px 12px', color: '#e0e0e0' }}>{org.name}</td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 4, fontSize: 11,
                    background: 'rgba(124,92,252,0.15)', color: '#c084fc',
                  }}>{org.planType}</span>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{ color: org.isActive ? '#4ade80' : '#f43f5e' }}>
                    {org.isActive ? '활성' : '비활성'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: '#888' }}>
                  {new Date(org.createdAt).toLocaleDateString('ko-KR')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
