import type { Booking, Room } from '@deskboard/shared';

/** Persistence port for rooms. */
export interface RoomRepository {
  findById(id: string): Promise<Room | null>;
  /** Case-insensitive lookup by name (uniqueness rule). */
  findByName(name: string): Promise<Room | null>;
  list(): Promise<Room[]>;
  create(room: Room): Promise<Room>;
  update(room: Room): Promise<Room>;
}

/** Persistence port for bookings. */
export interface BookingRepository {
  findById(id: string): Promise<Booking | null>;
  /** All bookings for a room, optionally restricted to a calendar date (YYYY-MM-DD). */
  listByRoom(roomId: string, date?: string): Promise<Booking[]>;
  listByOrganizer(organizerId: string): Promise<Booking[]>;
  create(booking: Booking): Promise<Booking>;
  update(booking: Booking): Promise<Booking>;
}
