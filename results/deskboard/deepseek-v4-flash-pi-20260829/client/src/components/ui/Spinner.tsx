import './ui.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

/** Accessible spinner (aria-busy is set by callers/Button). */
export function Spinner({ size = 'md', label = 'Loading' }: SpinnerProps) {
  return (
    <span className={`spinner spinner-${size}`} role="status" aria-label={label}>
      <span className="spinner-ring" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </span>
  );
}

/** Skeleton placeholder for loading states. */
export function Skeleton({
  width = '100%',
  height = '1em',
  className = '',
}: {
  width?: string | number;
  height?: string | number;
  className?: string;
}) {
  return <span className={`skeleton ${className}`} style={{ width, height }} aria-hidden="true" />;
}
