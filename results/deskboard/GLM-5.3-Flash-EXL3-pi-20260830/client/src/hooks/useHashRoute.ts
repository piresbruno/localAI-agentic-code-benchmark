/** Minimal hash router: `#/rooms?date=2026-09-07` → { path, query }. */
import { useCallback, useEffect, useState } from 'react';

export interface Route {
  path: string;
  query: URLSearchParams;
}

const parse = (): Route => {
  const raw = window.location.hash.replace(/^#/, '') || '/rooms';
  const [path, queryString = ''] = raw.split('?');
  return { path: path || '/rooms', query: new URLSearchParams(queryString) };
};

export function useHashRoute(): [Route, (to: string) => void] {
  const [route, setRoute] = useState<Route>(parse);

  useEffect(() => {
    const onHash = () => setRoute(parse());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((to: string) => {
    window.location.hash = to;
  }, []);

  return [route, navigate];
}
