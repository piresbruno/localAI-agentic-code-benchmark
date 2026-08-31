import type { ApiErrorBody, AuthResponseDto, AvailabilityDto, BookingDto, RoomDto, UserDto } from '@deskboard/shared';

/** Client-side error carrying the API error contract (`{ error: { code, message, details? } }`). */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details: { field: string; message: string }[];
  constructor(code: string, status: number, message: string, details: ApiErrorBody['error']['details'] = []) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details ?? [];
  }

  /** First field-level message for inline form errors. */
  fieldError(field: string): string | undefined {
    return this.details.find((d) => d.field === field)?.message;
  }
}

const TOKEN_KEY = 'deskboard.token';

export const getToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const setToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    ...Object.fromEntries(new Headers(init.headers).entries()),
  };
  const token = getToken();
  if (token) headers.authorization = `Bearer ${token}`;
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers });
  } catch {
    throw new ApiError('NETWORK', 0, 'Cannot reach the server. Check your connection and try again.');
  }
  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(err?.code ?? 'INTERNAL', res.status, err?.message ?? 'Unexpected server error.', err?.details);
  }
  return body as T;
}

/** Typed fetch wrapper over the §5 API surface; every call is same-origin `/api`. */
export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    request<AuthResponseDto>('/api/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: { email: string; password: string }) =>
    request<AuthResponseDto>('/api/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: () => request<UserDto>('/api/auth/me'),
  rooms: () => request<RoomDto[]>('/api/rooms'),
  createRoom: (input: { name: string; capacity: number; floor: number; features: string[] }) =>
    request<RoomDto>('/api/rooms', { method: 'POST', body: JSON.stringify(input) }),
  updateRoom: (id: string, input: Record<string, unknown>) =>
    request<RoomDto>(`/api/rooms/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deactivateRoom: (id: string) => request<RoomDto>(`/api/rooms/${id}`, { method: 'DELETE' }),
  availability: (roomId: string, date: string) =>
    request<AvailabilityDto>(`/api/rooms/${roomId}/availability?date=${date}`),
  createBooking: (input: { roomId: string; title: string; start: string; end: string; attendees: number }) =>
    request<BookingDto>('/api/bookings', { method: 'POST', body: JSON.stringify(input) }),
  myBookings: () => request<BookingDto[]>('/api/bookings/mine'),
  cancelBooking: (id: string) => request<BookingDto>(`/api/bookings/${id}`, { method: 'DELETE' }),
};
