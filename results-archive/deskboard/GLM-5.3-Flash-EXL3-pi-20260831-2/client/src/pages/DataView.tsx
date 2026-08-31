import { ReactNode } from 'react';
import { Spinner } from '../components/ui/Spinner';

export interface DataViewProps {
  loading: boolean;
  error: string | null;
  /** True when the loaded data set has no rows. */
  isEmpty: boolean;
  /** Empty-state content (message + call to action), shown only when isEmpty. */
  empty: ReactNode;
  children: ReactNode;
  retry: () => void;
}

/**
 * Shared loading/empty/error scaffold for data views (spec §7.3): spinner
 * while loading, friendly error with retry, empty state with call to action.
 */
export function DataView({ loading, error, isEmpty, empty, children, retry }: DataViewProps) {
  if (loading) {
    return (
      <div className="data-loading" aria-live="polite" aria-busy="true">
        <Spinner />
        <p className="muted">Loading…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="data-error" role="alert">
        <p>⚠ {error}</p>
        <button type="button" className="btn btn-secondary" onClick={retry}>
          Try again
        </button>
      </div>
    );
  }
  if (isEmpty) return <>{empty}</>;
  return <>{children}</>;
}
