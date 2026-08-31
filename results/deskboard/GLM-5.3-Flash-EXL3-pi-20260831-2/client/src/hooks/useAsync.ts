import { useCallback, useEffect, useState } from 'react';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  retry: () => void;
}

/**
 * Data-fetching state machine for data views: loading / error / data with a
 * retry action. Errors surface the API's safe message text, never stack traces.
 */
export function useAsync<T>(fetcher: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetcher()
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [...deps, attempt]); // deps are caller-controlled; attempt powers retry

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { data, loading, error, retry };
}
