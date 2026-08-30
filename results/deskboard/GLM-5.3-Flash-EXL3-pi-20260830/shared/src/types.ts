/**
 * Domain and DTO types shared by the server and the client.
 * This module is the single source of truth for API shapes.
 */

export type Role = 'admin' | 'employee';

export const ROOM_FEATURES = ['screen', 'whiteboard', 'videoconf', 'phone'] as const;
export type RoomFeature = (typeof ROOM_FEATURES)[number];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** User as returned by the API — never includes password material. */
export type PublicUser = Pick<User, 'id' | 'name' | 'email' | 'role'>;

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
  active: boolean;
  createdAt: string;
}

export interface RoomInput {
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
}

export type Recurrence = { kind: 'none' } | { kind: 'weekly'; count: number };

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

/**
 * A booking occurrence. Weekly recurrences are expanded into one record per
 * occurrence at creation time; occurrences of the same series share `groupId`.
 */
export interface Booking {
  id: string;
  groupId: string;
  roomId: string;
  title: string;
  organizerId: string;
  /** ISO-8601 local datetime, minutes precision (e.g. 2026-08-31T09:00). */
  start: string;
  end: string;
  recurrence: Recurrence;
  status: BookingStatus;
  attendees: number;
  createdAt: string;
}

export interface BookingInput {
  roomId: string;
  title: string;
  start: string;
  durationMinutes: number;
  attendees: number;
  recurrence: Recurrence;
}

/** Booking as returned by the API; `status` is computed, never stored. */
export interface BookingDto extends Omit<Booking, 'organizerId' | 'recurrence'> {
  organizer: PublicUser;
  recurrence: Recurrence;
  /** Present on occurrences that belong to a weekly series (count > 1). */
  seriesCount?: number;
}

export interface AvailabilitySlot {
  /** Slot start as HH:mm local time. */
  start: string;
  /** Slot end as HH:mm local time. */
  end: string;
  available: boolean;
  bookingId?: string;
  bookingTitle?: string;
}

export interface AvailabilityResponse {
  roomId: string;
  date: string;
  slots: AvailabilitySlot[];
}

export interface RoomUsage {
  room: Room;
  totalHours: number;
  bookingCount: number;
  topOrganizer: { name: string; hours: number } | null;
}

export interface UsageReport {
  from: string;
  to: string;
  rooms: RoomUsage[];
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}
