'use client';

import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export default function ErrorState({ message = '데이터를 불러오는 중 오류가 발생했습니다.', onRetry }: ErrorStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: '#FEF2F2',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <AlertTriangle size={28} color="#DC2626" />
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8 }}>
        오류 발생
      </h3>
      <p style={{ fontSize: '0.857rem', maxWidth: 360, lineHeight: 1.6, marginBottom: 20 }}>
        {message}
      </p>
      {onRetry && (
        <button className="btn btn-secondary" onClick={onRetry}>
          <RefreshCw size={16} /> 다시 시도
        </button>
      )}
    </div>
  );
}
