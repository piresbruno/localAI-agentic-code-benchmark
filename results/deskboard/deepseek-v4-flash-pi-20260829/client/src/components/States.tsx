import type { ReactNode } from 'react';

/** Shared data-view states: loading / empty / error. Used by every page. */
export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state state-loading" role="status">
      <span className="spinner spinner-md" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
      <div className="skeleton skeleton-block" aria-hidden="true" />
      <div className="skeleton skeleton-block skeleton-short" aria-hidden="true" />
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="state state-empty">
      <p className="state-title">{title}</p>
      {action ? <div className="state-action">{action}</div> : null}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state state-error" role="alert">
      <p className="state-title">{message}</p>
      <button type="button" className="btn btn-secondary" onClick={onRetry}>
        Retry
      </button>
    </div>
  );
}
