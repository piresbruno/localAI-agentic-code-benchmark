import type { ReactNode } from 'react';
import './ui.css';

export interface BadgeProps {
  tone: 'success' | 'warning' | 'danger' | 'neutral' | 'primary';
  children: ReactNode;
}

const ICONS: Record<BadgeProps['tone'], string> = {
  success: '●',
  warning: '●',
  danger: '●',
  neutral: '○',
  primary: '○',
};

/** Status/feature tag: icon + text, never color alone. */
export function Badge({ tone, children }: BadgeProps) {
  return (
    <span className={`badge badge-${tone}`}>
      <span aria-hidden="true" className="badge-icon">
        {ICONS[tone]}
      </span>
      {children}
    </span>
  );
}

export function bookingStatusTone(status: string): BadgeProps['tone'] {
  switch (status) {
    case 'confirmed':
      return 'success';
    case 'completed':
      return 'primary';
    case 'cancelled':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function roomStatusTone(active: boolean): BadgeProps['tone'] {
  return active ? 'primary' : 'neutral';
}

export function bookingStatusLabel(status: string): string {
  return status.charAt(0).toUpperCase() + status.slice(1);
}
