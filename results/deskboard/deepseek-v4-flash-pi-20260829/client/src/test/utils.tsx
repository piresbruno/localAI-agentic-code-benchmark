import { vi } from 'vitest';

/**
 * Shared test helpers: provider-wrapped renders and a fetch stub that mimics
 * the API error contract.
 */
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';
import { MemoryRouter } from 'react-router-dom';
import type { ApiErrorBody } from 'shared';
import { AuthProvider } from '../hooks/useAuth';
import { ToastProvider } from '../components/ui/Toast';

export const TOKEN = 'test-token';
export const USER = {
  id: 'u1',
  name: 'Grace Hopper',
  email: 'grace@example.com',
  role: 'employee' as const,
};

export function renderWithProviders(ui: ReactElement, { route = '/', token = true } = {}) {
  if (token) window.localStorage.setItem('deskboard.token', TOKEN);
  else window.localStorage.removeItem('deskboard.token');
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <ToastProvider>{ui}</ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** Real Response JSON factory — matches the browser fetch contract. */
export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Convenience: 200 JSON. */
export function okResponse(data: unknown): Response {
  return jsonResponse(data, 200);
}

/** Convenience: an `{ error }` body with the given status. */
export function errorResponse(status: number, error: ApiErrorBody): Response {
  return jsonResponse({ error }, status);
}

/**
 * Stub global fetch routing by URL. Handlers return either a Response or a
 * plain value that is JSON-stringified with 200.
 */
export function stubFetch(routes: Record<string, (init?: RequestInit) => unknown | Response>) {
  const calls: Array<{ url: string; method: string; body?: unknown }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    let body: unknown;
    if (init?.body) {
      try {
        body = JSON.parse(String(init.body));
      } catch {
        body = init.body;
      }
    }
    calls.push({ url, method: init?.method ?? 'GET', body });
    const handler = routes[url];
    if (!handler) throw new Error(`Unhandled fetch in test: ${init?.method ?? 'GET'} ${url}`);
    const result = await handler(init);
    return result instanceof Response ? result : jsonResponse(result, 200);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}
