/**
 * Typed fetch wrapper over the shared DTOs. The only place that touches
 * `fetch`; maps the API's error contract onto a typed ApiClientError.
 */
import type {
  AuthResponse,
  BookingView,
  PublicUser,
  Room,
  RoomAvailability,
  UsageReportEntry,
} from '@deskboard/shared';

export class ApiClientError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Thrown when the network itself fails (server down). */
export class NetworkError extends Error {
  constructor() {
    super('Cannot reach the server. Check your connection and try again.');
  }
}

type TokenGetter = () => string | null;

let getToken: TokenGetter = () => null;

/** Registers how the client reads the current session token. */
export function setTokenGetter(getter: TokenGetter): void {
  getToken = getter;
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
  } catch {
    throw new NetworkError();
  }

  if (response.status === 204) return undefined as T;

  const payload = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    const err = payload?.error;
    throw new ApiClientError(
      response.status,
      err?.code ?? 'INTERNAL',
      err?.message ?? 'Unexpected error. Please try again.',
      err?.details,
    );
  }
  return payload as T;
}

export const api = {
  register: (input: { name: string; email: string; password: string }) =>
    request<AuthResponse>('POST', '/api/auth/register', input),
  login: (input: { email: string; password: string }) =>
    request<AuthResponse>('POST', '/api/auth/login', input),
  me: () => request<PublicUser>('GET', '/api/auth/me'),
  changePassword: (input: { currentPassword: string; newPassword: string }) =>
    request<void>('PUT', '/api/users/me/password', input),

  listRooms: () => request<Room[]>('GET', '/api/rooms'),
  createRoom: (input: unknown) => request<Room>('POST', '/api/rooms', input),
  updateRoom: (id: string, input: unknown) => request<Room>('PUT', `/api/rooms/${id}`, input),
  deactivateRoom: (id: string) => request<Room>('DELETE', `/api/rooms/${id}`),
  availability: (roomId: string, date: string) =>
    request<RoomAvailability>('GET', `/api/rooms/${roomId}/availability?date=${date}`),

  createBooking: (input: unknown) => request<BookingView>('POST', '/api/bookings', input),
  myBookings: () => request<BookingView[]>('GET', '/api/bookings/mine'),
  listBookings: (filters: { date?: string; roomId?: string }) => {
    const params = new URLSearchParams();
    if (filters.date) params.set('date', filters.date);
    if (filters.roomId) params.set('roomId', filters.roomId);
    const qs = params.toString();
    return request<BookingView[]>('GET', `/api/bookings${qs ? `?${qs}` : ''}`);
  },
  cancelBooking: (id: string) => request<BookingView>('DELETE', `/api/bookings/${id}`),

  usage: (from: string, to: string) =>
    request<UsageReportEntry[]>('GET', `/api/admin/usage?from=${from}&to=${to}`),
};
