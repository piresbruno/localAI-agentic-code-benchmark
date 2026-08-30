/**
 * Typed fetch wrapper over the shared DTOs. Attaches the stored bearer
 * token, unwraps the API error contract into `ApiError`.
 */
import type {
  AuthResponse,
  AvailabilityResponse,
  BookingDto,
  PublicUser,
  Room,
  RoomInput,
  UsageReport
} from 'deskboard-shared';

const TOKEN_KEY = 'deskboard_token';

export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const jsonHeaders = (token: string | null): HeadersInit => {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

async function request<T>(path: string, init: RequestInit = {}, token?: string | null): Promise<T> {
  const bearer = token ?? readToken();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: jsonHeaders(bearer ?? null),
    ...(init.body ? { body: init.body } : {})
  });
  if (!res.ok) {
    let code = 'INTERNAL';
    let message = 'Something went wrong';
    let details: unknown;
    try {
      const body = (await res.json()) as { error?: { code?: string; message?: string; details?: unknown } };
      code = body.error?.code ?? code;
      message = body.error?.message ?? message;
      details = body.error?.details;
    } catch {
      // keep defaults for non-JSON error bodies
    }
    throw new ApiError(code, message, res.status, details);
  }
  return (await res.json()) as T;
}

export const readToken = (): string | null => localStorage.getItem(TOKEN_KEY);
export const storeToken = (token: string): void => localStorage.setItem(TOKEN_KEY, token);
export const clearToken = (): void => localStorage.removeItem(TOKEN_KEY);

const post = <T,>(path: string, body: unknown, token?: string) =>
  request<T>(path, { method: 'POST', body: JSON.stringify(body) }, token);
const put = <T,>(path: string, body: unknown) =>
  request<T>(path, { method: 'PUT', body: JSON.stringify(body) });
const del = <T,>(path: string) => request<T>(path, { method: 'DELETE' });

export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    post<AuthResponse>('/auth/register', input),
  login: (input: { email: string; password: string }) => post<AuthResponse>('/auth/login', input),
  me: () => request<PublicUser>('/auth/me'),
  rooms: () => request<Room[]>('/rooms'),
  createRoom: (input: RoomInput) => post<Room>('/rooms', input),
  updateRoom: (id: string, patch: Partial<RoomInput>) => put<Room>(`/rooms/${id}`, patch),
  deactivateRoom: (id: string) => del<Room>(`/rooms/${id}`),
  availability: (roomId: string, date: string) =>
    request<AvailabilityResponse>(`/rooms/${roomId}/availability?date=${date}`),
  createBooking: (input: {
    roomId: string;
    title: string;
    start: string;
    durationMinutes: number;
    attendees: number;
    recurrence: { kind: 'none' } | { kind: 'weekly'; count: number };
  }) => post<BookingDto[]>('/bookings', input),
  myBookings: () => request<BookingDto[]>('/bookings/mine'),
  cancelBooking: (id: string) => del<BookingDto>(`/bookings/${id}`),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    put<{ ok: boolean }>('/users/me/password', input),
  usage: (from: string, to: string) =>
    request<UsageReport>(`/admin/usage?from=${from}&to=${to}`)
};
