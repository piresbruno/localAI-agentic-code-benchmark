interface SpinnerProps {
  size?: 'small' | 'large';
  label?: string;
}

/** Indeterminate loading spinner used by loading states and loading buttons. */
export function Spinner({ size = 'large', label = 'Loading' }: SpinnerProps) {
  return (
    <span
      className={`spinner spinner--${size}`}
      role="status"
      aria-label={label}
      data-testid="spinner"
    />
  );
}
