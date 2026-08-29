/** Spinner — used by loading states and pending buttons. */
interface SpinnerProps {
  /** Diameter in px (default 20). */
  size?: number;
  label?: string;
}

export function Spinner({ size = 20, label = 'Loading…' }: SpinnerProps) {
  return (
    <span
      className="spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  );
}

/** Skeleton block for loading placeholders. */
export function Skeleton({ height = 20 }: { height?: number }) {
  return <div className="skeleton" style={{ height }} aria-hidden="true" />;
}

/** Several stacked skeleton rows. */
export function SkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div className="skeleton-row" role="status" aria-label="Loading content">
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} height={44} />
      ))}
    </div>
  );
}
