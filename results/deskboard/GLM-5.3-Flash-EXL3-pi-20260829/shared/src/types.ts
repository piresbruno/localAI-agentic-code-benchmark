/** Shared domain types for DeskBoard. Single source of truth for both server and client. */

export type Role = 'admin' | 'employee';

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
}

/** User as exposed by the API — never includes the password hash. */
export type PublicUser = Omit<User, never>;

export const ROOM_FEATURES = ['screen', 'whiteboard', 'videoconf', 'phone'] as const;
export type RoomFeature = (typeof ROOM_FEATURES)[number];

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
  active: boolean;
  createdAt: string;
}

export type RecurrenceSpec = { kind: 'none' } | { kind: 'weekly'; count: number };

export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export interface BookingOccurrence {
  /** ISO-8601 with minutes precision, e.g. 2026-08-29T10:00 */
  start: string;
  end: string;
}

export interface Booking {
  id: string;
  roomId: string;
  title: string;
  organizerId: string;
  start: string;
  end: string;
  recurrence: RecurrenceSpec;
  status: BookingStatus;
  attendees: number;
  createdAt: string;
}

/** Booking enriched with organizer name and computed occurrence list (API shape). */
export interface BookingView extends Booking {
  organizerName: string;
  roomName: string;
  occurrences: BookingOccurrence[];
}

/** Free/busy grid cell for one room on one day. */
export interface AvailabilitySlot {
  /** Slot start time, HH:mm */
  time: string;
  /** Booking occupying this slot, if any */
  bookingId: string | null;
  bookingTitle: string | null;
}

export interface RoomAvailability {
  roomId: string;
  roomName: string;
  slots: AvailabilitySlot[];
}

export interface UsageReportEntry {
  roomId: string;
  roomName: string;
  totalBookedMinutes: number;
  bookingCount: number;
  topOrganizer: string | null;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

/** Standard API error envelope. */
export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
