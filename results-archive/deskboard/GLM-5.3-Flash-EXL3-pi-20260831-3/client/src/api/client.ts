import type { ApiErrorBody } from '@deskboard/shared';

/**
 * Typed fetch wrapper over the shared DTOs. Attaches the bearer token,
 * unwraps the shared error contract into `ApiError`.
 */

let authToken: string | null = null;

/** Called by the auth hook on login/logout/boot. */
export function setAuthToken(token: string | null): void {
  authToken = token;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level messages from 400 validation failures, if any. */
  get fieldErrors(): Record<string, string[]> {
    return typeof this.details === 'object' && this.details !== null
      ? (this.details as Record<string, string[]>)
      : {};
  }
}

async function parseError(response: Response): Promise<ApiError> {
  let code = 'INTERNAL';
  let message = 'Something went wrong';
  let details: unknown;
  try {
    const body = (await response.json()) as ApiErrorBody;
    code = body.error.code;
    message = body.error.message;
    details = body.error.details;
  } catch {
    // Non-JSON failure (e.g. network/HTML error page): keep generic message.
  }
  return new ApiError(response.status, code, message, details);
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (authToken) headers['Authorization'] = `Bearer ${authToken}`;

  const response = await fetch(`/api${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  del: <T>(path: string) => request<T>('DELETE', path),
};
