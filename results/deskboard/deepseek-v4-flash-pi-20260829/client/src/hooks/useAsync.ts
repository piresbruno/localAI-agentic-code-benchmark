import { useCallback, useEffect, useRef, useState } from 'react';
import type { DependencyList } from 'react';

export interface AsyncState<T> {
  /** True only while no data has been loaded yet. */
  loading: boolean;
  /** Set when a reload is in flight after initial load. */
  refreshing: boolean;
  data: T | null;
  error: string | null;
  reload: () => void;
}

/**
 * Generic data-fetching hook: loading / error / data + reload.
 * Every data view in the app renders from one of these three states.
 */
export function useAsync<T>(fn: () => Promise<T>, deps: DependencyList): AsyncState<T> {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError(null);
    fnRef
      .current()
      .then((value) => {
        if (!alive) return;
        setData(value);
      })
      .catch((err: unknown) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : 'Something went wrong');
      })
      .finally(() => {
        if (!alive) return;
        setLoading(false);
        setRefreshing(false);
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);

  const reload = useCallback(() => {
    setRefreshing(true);
    setTick((t) => t + 1);
  }, []);

  return { loading, refreshing, data, error, reload };
}
