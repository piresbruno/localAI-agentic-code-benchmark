import type { ReactNode } from 'react';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';

/** Shared UX-state blocks (spec §7.3): skeleton loading, empty, error + retry. */

export function LoadingBlock({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="loading-block" role="status">
      <Spinner label={label} />
      <span>{label}</span>
    </div>
  );
}

export function GridSkeleton() {
  return (
    <div className="grid-scroll" aria-hidden="true" data-testid="grid-skeleton">
      {Array.from({ length: 5 }).map((_, row) => (
        <div key={row} style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-2)' }}>
          <div className="skeleton" style={{ width: 140, height: 44 }} />
          {Array.from({ length: 11 }).map((__, cell) => (
            <div key={cell} className="skeleton" style={{ width: 88, height: 44 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {children && <div>{children}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Something went wrong</p>
      <p>{message}</p>
      <div className="state__actions">
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      </div>
    </div>
  );
}
