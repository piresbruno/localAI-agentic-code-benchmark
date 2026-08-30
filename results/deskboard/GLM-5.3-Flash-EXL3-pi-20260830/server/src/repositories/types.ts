/**
 * Persistence ports. The domain depends only on these interfaces;
 * `in-memory/` provides the production/test implementation and a README
 * note explains where a real DB adapter would plug in.
 */
import type { Booking, BookingStatus, Room, User } from 'deskboard-shared';

export interface StoredUser extends User {
  passwordHash: string;
}

export interface UserRepository {
  create(user: StoredUser): StoredUser;
  findById(id: string): StoredUser | null;
  findByEmail(email: string): StoredUser | null;
  updatePasswordHash(id: string, passwordHash: string): StoredUser | null;
}

export interface RoomRepository {
  create(room: Room): Room;
  findById(id: string): Room | null;
  findByNameIgnoreCase(name: string): Room | null;
  list(): Room[];
  save(room: Room): Room;
}

export interface BookingQuery {
  roomId?: string;
  organizerId?: string;
  /** Inclusive lower bound on `start` (same ISO format as Booking.start). */
  fromStart?: string;
  /** Inclusive upper bound on `start`. */
  toStart?: string;
  /** Calendar day filter on `start` (YYYY-MM-DD). */
  date?: string;
}

export interface BookingRepository {
  create(booking: Booking): Booking;
  findById(id: string): Booking | null;
  /** Confirmed (not cancelled) bookings overlapping [start, end) on the room. */
  findConfirmedOverlapping(roomId: string, start: string, end: string): Booking[];
  list(query: BookingQuery): Booking[];
  setStatus(id: string, status: BookingStatus): Booking | null;
}
