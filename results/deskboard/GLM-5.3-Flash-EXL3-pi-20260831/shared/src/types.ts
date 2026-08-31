/** User roles. Anyone may self-register as `employee`; admins are seeded or promoted by admins. */
export type Role = 'admin' | 'employee';

/** Bookable room equipment. */
export type RoomFeature = 'screen' | 'whiteboard' | 'videoconf' | 'phone';

/** Stored booking status; `completed` is computed on read, never persisted. */
export type StoredBookingStatus = 'confirmed' | 'cancelled';

/** Booking status as seen by clients (completion computed against current time). */
export type BookingStatus = StoredBookingStatus | 'completed';

export interface UserDto {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface RoomDto {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
  active: boolean;
}

export interface BookingDto {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  organizerId: string;
  organizerName: string;
  /** Naive local ISO-8601 at minutes precision, e.g. `2026-08-31T09:00`. */
  start: string;
  end: string;
  status: BookingStatus;
  attendees: number;
  createdAt: string;
}

export interface AvailabilitySlotDto {
  /** Slot start time-of-day, `HH:mm`. */
  start: string;
  /** Slot end time-of-day, `HH:mm`. */
  end: string;
  booking: { id: string; title: string } | null;
}

export interface AvailabilityDto {
  roomId: string;
  /** `YYYY-MM-DD`. */
  date: string;
  slots: AvailabilitySlotDto[];
}

export interface AuthResponseDto {
  token: string;
  user: UserDto;
}
