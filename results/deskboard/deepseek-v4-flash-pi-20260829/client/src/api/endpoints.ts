import type {
  AuthResponse,
  AvailabilityResponse,
  BookingCreateRequest,
  BookingResponse,
  PublicUser,
  Room,
  RoomCreateRequest,
  RoomUpdateRequest,
  UsageResponse,
} from 'shared';
import { api } from './client';

export const authApi = {
  register: (body: { name: string; email: string; password: string }) =>
    api.post<AuthResponse>('/api/auth/register', body),
  login: (body: { email: string; password: string }) =>
    api.post<AuthResponse>('/api/auth/login', body),
  me: () => api.get<PublicUser>('/api/auth/me'),
  changePassword: (body: { currentPassword: string; newPassword: string }) =>
    api.put<{ ok: boolean }>('/api/users/me/password', body),
};

export const roomsApi = {
  list: () => api.get<Room[]>('/api/rooms'),
  create: (body: RoomCreateRequest) => api.post<Room>('/api/rooms', body),
  update: (id: string, body: RoomUpdateRequest) => api.put<Room>(`/api/rooms/${id}`, body),
  deactivate: (id: string) => api.del<Room>(`/api/rooms/${id}`),
  availability: (roomId: string, date: string) =>
    api.get<AvailabilityResponse>(`/api/rooms/${roomId}/availability?date=${date}`),
};

export const bookingsApi = {
  create: (body: BookingCreateRequest) => api.post<BookingResponse[]>('/api/bookings', body),
  mine: () => api.get<BookingResponse[]>('/api/bookings/mine'),
  list: (params: { date?: string; roomId?: string } = {}) => {
    const q = new URLSearchParams();
    if (params.date) q.set('date', params.date);
    if (params.roomId) q.set('roomId', params.roomId);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return api.get<BookingResponse[]>(`/api/bookings${suffix}`);
  },
  cancel: (id: string) => api.del<BookingResponse>(`/api/bookings/${id}`),
};

export const adminApi = {
  usage: (from?: string, to?: string) => {
    const q = new URLSearchParams();
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    const suffix = q.toString() ? `?${q.toString()}` : '';
    return api.get<UsageResponse>(`/api/admin/usage${suffix}`);
  },
};
