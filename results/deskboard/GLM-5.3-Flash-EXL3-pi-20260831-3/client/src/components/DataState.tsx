import type { ReactNode } from 'react';
import { Button } from './ui/Button.js';
import { Spinner } from './ui/Spinner.js';

interface DataStateProps {
  loading: boolean;
  error: string | null;
  empty: boolean;
  /** Empty-state content: human message + call to action. */
  emptyContent: ReactNode;
  onRetry: () => void;
  children: ReactNode;
}

/**
 * Shared loading/empty/error wrapper so every data view implements all
 * §7.3 UX states consistently (never an unstyled blank flash, never raw JSON).
 */
export function DataState({
  loading,
  error,
  empty,
  emptyContent,
  onRetry,
  children,
}: DataStateProps) {
  if (loading) {
    return (
      <div className="data-state" role="status">
        <Spinner />
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="data-state data-state--error" role="alert">
        <p>
          <span aria-hidden="true">⚠</span> Something went wrong: {error}
        </p>
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (empty) {
    return <div className="data-state">{emptyContent}</div>;
  }
  return <>{children}</>;
}
