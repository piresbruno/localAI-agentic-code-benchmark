/**
 * Domain types and DTOs shared by the server and the client.
 * This module is the single source of truth for wire shapes.
 */

export type Role = 'admin' | 'employee';

/** Anyone may self-register, always as an employee; admins exist via seeding. */
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export const ROOM_FEATURES = ['screen', 'whiteboard', 'videoconf', 'phone'] as const;
export type RoomFeature = (typeof ROOM_FEATURES)[number];

export interface Room {
  id: string;
  /** Unique, case-insensitive. */
  name: string;
  /** 1–100 people. */
  capacity: number;
  /** Building floor, 1–30. */
  floor: number;
  features: RoomFeature[];
  /** Deactivated rooms reject new bookings but keep their history. */
  active: boolean;
}

/** Stored booking status is only confirmed | cancelled; `completed` is computed on read. */
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export interface Booking {
  id: string;
  roomId: string;
  /** 1–100 chars. */
  title: string;
  organizerId: string;
  /** ISO-8601 local wall-clock, minutes precision: YYYY-MM-DDTHH:mm */
  start: string;
  end: string;
  status: BookingStatus;
  /** Must not exceed the room capacity. */
  attendees: number;
  createdAt: string;
}

/** Booking as returned by the API, with computed status and denormalized room name. */
export interface BookingDto extends Booking {
  roomName: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface AvailabilitySlot {
  /** HH:mm, e.g. "08:00" */
  start: string;
  end: string;
  available: boolean;
}

export interface AvailabilityResponse {
  roomId: string;
  /** YYYY-MM-DD */
  date: string;
  slots: AvailabilitySlot[];
}

/** Shared error contract: every API failure uses this shape (spec §5). */
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

/** Domain constants used by both server rules and client slot computation. */
export const BUSINESS_START_HOUR = 8;
export const BUSINESS_END_HOUR = 19;
/** Bookings only Mon–Fri (ISO day 1–5). */
export const BUSINESS_DAYS = [1, 2, 3, 4, 5];
export const MAX_BOOKING_MINUTES = 240;
export const CANCELLATION_WINDOW_MINUTES = 60;
export const BOOKING_DURATION_OPTIONS = [30, 60, 90, 120] as const;
