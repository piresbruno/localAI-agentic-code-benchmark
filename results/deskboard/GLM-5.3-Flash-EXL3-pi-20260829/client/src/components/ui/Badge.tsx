/** Badge/Tag — booking status and room features. Status is never color alone: icon/text prefix included. */
const STATUS_LABEL: Record<string, string> = {
  confirmed: '✓ Confirmed',
  cancelled: '✕ Cancelled',
  completed: '• Completed',
};

export function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABEL[status] ?? status;
  return (
    <span className={`badge badge--${status}`}>{label}</span>
  );
}

export function FeatureTag({ feature }: { feature: string }) {
  const icon: Record<string, string> = {
    screen: '🖥',
    whiteboard: '✎',
    videoconf: '📹',
    phone: '☎',
  };
  return (
    <span className="badge badge--feature">
      {icon[feature] ?? ''} {feature}
    </span>
  );
}
