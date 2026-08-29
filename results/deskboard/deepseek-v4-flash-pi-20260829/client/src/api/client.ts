import type { ApiErrorCode } from 'shared';

export const TOKEN_STORAGE_KEY = 'deskboard.token';

/** API error carrying the shared `{ error: { code, message, details } }` contract. */
export class ApiError extends Error {
  readonly code: ApiErrorCode | 'NETWORK';
  readonly status: number;
  readonly details?: unknown;

  constructor(code: ApiErrorCode | 'NETWORK', message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_STORAGE_KEY);
}

export function setToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_STORAGE_KEY, token);
  else window.localStorage.removeItem(TOKEN_STORAGE_KEY);
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(init.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError('NETWORK', 'Could not reach the server. Is it running?', 0);
  }

  const data = (await response.json().catch(() => null)) as { error?: { code: ApiErrorCode; message: string; details?: unknown } } | null;

  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(
      error?.code ?? 'INTERNAL',
      error?.message ?? `Request failed (${response.status})`,
      response.status,
      error?.details,
    );
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'POST', body: body === undefined ? undefined : JSON.stringify(body) }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: 'PUT', body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
