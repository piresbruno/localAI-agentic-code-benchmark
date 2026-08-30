/** Spinner — loading indicator used by buttons, tables and page states. */
import '../ui.css';

export interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  label?: string;
}

export function Spinner({ size = 'md', label = 'Loading' }: SpinnerProps) {
  return (
    <span
      className={`spinner spinner--${size}`}
      role="status"
      aria-label={label}
      data-testid="spinner"
    />
  );
}
