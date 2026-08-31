import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '../api/client';

export interface Resource<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/** Friendly message for any thrown error — never raw JSON or stack traces. */
export function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  return 'Something went wrong. Please try again.';
}

/**
 * Data-fetching hook backing the loading/empty/error UX states (spec §7.3).
 * Refetches when `deps` change or when `retry` is called.
 */
export function useResource<T>(fetcher: () => Promise<T>, deps: unknown[]): Resource<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fetcher()
      .then((res) => {
        if (alive) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (alive) {
          setError(toMessage(err));
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
    // fetcher identity is intentionally not a dependency; `deps` + retry drive refetches.
  }, [...deps, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, loading, error, retry };
}

/** Formats a Date as `YYYY-MM-DD` in local time (date-picker + grid default). */
export function todayIso(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
