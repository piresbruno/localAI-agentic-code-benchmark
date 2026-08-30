/** Badge — status and feature tags; never color alone (always has text). */
export interface BadgeProps {
  variant?: 'neutral' | 'success' | 'warning' | 'danger' | 'info';
  children: React.ReactNode;
}

export function Badge({ variant = 'neutral', children }: BadgeProps) {
  return <span className={`badge badge--${variant}`}>{children}</span>;
}
