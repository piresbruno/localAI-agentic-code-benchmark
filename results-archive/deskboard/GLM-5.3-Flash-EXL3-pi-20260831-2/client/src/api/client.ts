import {
  ApiErrorBody,
  AuthResponse,
  AvailabilityDTO,
  Booking,
  LoginInput,
  RegisterInput,
  Room,
  RoomInput,
  User,
} from '@deskboard/shared';

const API_BASE = '/api';
const TOKEN_KEY = 'deskboard.token';

/* ---- token store: memory + localStorage (spec §6) ---------------------- */

let token: string | null = readStoredToken();

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null; // storage unavailable (e.g. hardened browsers)
  }
}

export function getToken(): string | null {
  return token;
}

export function setToken(next: string | null): void {
  token = next;
  try {
    if (next) localStorage.setItem(TOKEN_KEY, next);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore storage failures; in-memory token still works for the session */
  }
}

/* ---- typed fetch wrapper ---------------------------------------------- */

/** Error carrying the API's error contract into the UI. */
export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, string[]>;

  constructor(status: number, body: ApiErrorBody['error']) {
    super(body.message);
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  const current = getToken();
  if (current) headers.Authorization = `Bearer ${current}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch {
    throw new ApiError(0, {
      code: 'NETWORK_ERROR',
      message: 'Cannot reach the server. Check your connection and try again.',
    });
  }

  const body = res.status === 204 ? null : await res.json().catch(() => null);
  if (!res.ok) {
    const err = (body as ApiErrorBody | null)?.error;
    throw new ApiError(res.status, {
      code: err?.code ?? 'UNKNOWN',
      message: err?.message ?? `Request failed with status ${res.status}`,
      ...(err?.details ? { details: err.details } : {}),
    });
  }
  return body as T;
}

/* ---- typed endpoints ---------------------------------------------------- */

export const api = {
  register: (input: RegisterInput) =>
    apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: JSON.stringify(input) }),
  login: (input: LoginInput) =>
    apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: JSON.stringify(input) }),
  me: () => apiFetch<User>('/auth/me'),

  listRooms: () => apiFetch<Room[]>('/rooms'),
  createRoom: (input: RoomInput) =>
    apiFetch<Room>('/rooms', { method: 'POST', body: JSON.stringify(input) }),
  updateRoom: (id: string, input: RoomInput) =>
    apiFetch<Room>(`/rooms/${id}`, { method: 'PUT', body: JSON.stringify(input) }),
  deactivateRoom: (id: string) => apiFetch<Room>(`/rooms/${id}`, { method: 'DELETE' }),
  availability: (roomId: string, date: string) =>
    apiFetch<AvailabilityDTO>(`/rooms/${roomId}/availability?date=${date}`),

  createBooking: (input: {
    roomId: string;
    title: string;
    start: string;
    end: string;
    attendees: number;
  }) => apiFetch<Booking>('/bookings', { method: 'POST', body: JSON.stringify(input) }),
  myBookings: () => apiFetch<Booking[]>('/bookings/mine'),
  cancelBooking: (id: string) => apiFetch<Booking>(`/bookings/${id}`, { method: 'DELETE' }),
};
