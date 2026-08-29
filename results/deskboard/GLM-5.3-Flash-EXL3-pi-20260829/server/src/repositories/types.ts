/**
 * Persistence contracts. The domain depends only on these interfaces;
 * an in-memory implementation lives beside them. A real database adapter
 * would implement the same interfaces and be wired in composition root
 * (app.ts) — no service or HTTP code would change.
 */
import type { Booking, Room, User } from '@deskboard/shared';

export interface UserRepository {
  findByEmail(email: string): User | undefined;
  findById(id: string): User | undefined;
  /** Stores the user; `passwordHash` is kept out of the domain User type. */
  create(user: User, passwordHash: string): void;
  /** Returns the stored hash for password verification, if the user exists. */
  getPasswordHash(userId: string): string | undefined;
  updatePasswordHash(userId: string, passwordHash: string): void;
}

export interface RoomRepository {
  findAll(): Room[];
  findById(id: string): Room | undefined;
  findByNameIgnoreCase(name: string): Room | undefined;
  create(room: Room): void;
  update(room: Room): void;
}

export interface BookingRepository {
  findAll(): Booking[];
  findById(id: string): Booking | undefined;
  findByOrganizerId(organizerId: string): Booking[];
  create(booking: Booking): void;
  update(booking: Booking): void;
}
