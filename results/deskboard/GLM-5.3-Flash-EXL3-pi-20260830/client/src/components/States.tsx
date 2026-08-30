/** Shared page-state components: loading skeleton, empty, error+retry. */
import { Button } from './ui/Button.js';
import { Spinner } from './ui/Spinner.js';

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <Spinner size="lg" label={label} />
      <p>{label}</p>
    </div>
  );
}

export function EmptyState({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="state">
      <p className="state__title">{title}</p>
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="state state--error" role="alert">
      <p className="state__title">Something went wrong</p>
      <p>{message}</p>
      <Button variant="secondary" onClick={onRetry}>
        Retry
      </Button>
    </div>
  );
}
