'use client';

import { Inbox } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title = '데이터가 없습니다',
  description = '아직 등록된 데이터가 없습니다.',
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '48px 24px', textAlign: 'center', color: 'var(--text-muted)',
    }}>
      <div style={{
        width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-hover)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
      }}>
        <Icon size={28} />
      </div>
      <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8 }}>
        {title}
      </h3>
      <p style={{ fontSize: '0.857rem', maxWidth: 360, lineHeight: 1.6, marginBottom: actionLabel ? 20 : 0 }}>
        {description}
      </p>
      {actionLabel && onAction && (
        <button className="btn btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
