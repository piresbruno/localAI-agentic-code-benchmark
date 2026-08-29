/**
 * DeskBoard domain types and API DTOs — the shape contract shared by server
 * and client. Validation schemas live in schemas.ts (same single source).
 */

export type Role = 'admin' | 'employee';
export type Feature = 'screen' | 'whiteboard' | 'videoconf' | 'phone';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export type Recurrence = { kind: 'none' } | { kind: 'weekly'; count: number };

/** ISO-8601 timestamps, minute precision, always UTC ('Z') or with offset. */
export type IsoDateTime = string;
/** Calendar date as YYYY-MM-DD (server-local day). */
export type CalendarDate = string;

// ---------------------------------------------------------------------------
// Persisted entities (server-side stores)
// ---------------------------------------------------------------------------

export interface User {
  id: string;
  name: string;
  email: string;
  /** scrypt hash rendered as `salt:hash` (hex) — never exposed. */
  passwordHash: string;
  role: Role;
  createdAt: IsoDateTime;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  features: Feature[];
  active: boolean;
}

export interface Booking {
  id: string;
  roomId: string;
  title: string;
  organizerId: string;
  start: IsoDateTime;
  end: IsoDateTime;
  recurrence: Recurrence;
  /** Stored status: confirmed | cancelled. 'completed' is computed on read. */
  status: 'confirmed' | 'cancelled';
  attendees: number;
  createdAt: IsoDateTime;
}

// ---------------------------------------------------------------------------
// API DTOs
// ---------------------------------------------------------------------------

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface AuthResponse {
  token: string;
  user: PublicUser;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface RoomCreateRequest {
  name: string;
  capacity: number;
  floor: number;
  features: Feature[];
}

export interface RoomUpdateRequest {
  name?: string;
  capacity?: number;
  floor?: number;
  features?: Feature[];
}

export interface BookingCreateRequest {
  roomId: string;
  title: string;
  /** Booking start, ISO-8601 minute precision. */
  start: IsoDateTime;
  /** Length in minutes; must be multiple of 30 and ≤ 4 hours. */
  durationMinutes: number;
  attendees: number;
  recurrence: Recurrence;
}

/** Booking as returned by the API — `status` may be the computed 'completed'. */
export interface BookingResponse {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  organizerId: string;
  start: IsoDateTime;
  end: IsoDateTime;
  recurrence: Recurrence;
  status: BookingStatus;
  attendees: number;
  createdAt: IsoDateTime;
}

export type AvailabilitySlotStatus = 'free' | 'busy';

export interface AvailabilitySlot {
  /** Slot start (ISO, local server time). */
  start: IsoDateTime;
  /** Slot end (start + 1h). */
  end: IsoDateTime;
  status: AvailabilitySlotStatus;
  /** Occupying bookings (empty when free). */
  bookings: Array<{
    id: string;
    title: string;
    status: BookingStatus;
    organizerId: string;
  }>;
}

export interface AvailabilityResponse {
  date: CalendarDate;
  roomId: string;
  roomName: string;
  /** One-hour slots from 08:00 to 19:00 local. */
  slots: AvailabilitySlot[];
}

export interface UsageRoomRow {
  roomId: string;
  roomName: string;
  /** Sum of overlap (hours, 1 decimal) of confirmed/completed bookings. */
  bookedHours: number;
  bookings: number;
  topOrganizer: { email: string; bookings: number } | null;
}

export interface UsageResponse {
  from: CalendarDate;
  to: CalendarDate;
  rooms: UsageRoomRow[];
}
