/** In-memory implementations of the repository interfaces. Storage only — no business decisions. */
import type { Booking, Room, User } from '@deskboard/shared';
import type { BookingRepository, RoomRepository, UserRepository } from './types.js';

interface UserRecord {
  user: User;
  passwordHash: string;
}

export class InMemoryUserRepository implements UserRepository {
  private readonly records = new Map<string, UserRecord>();

  findByEmail(email: string): User | undefined {
    const needle = email.toLowerCase();
    for (const record of this.records.values()) {
      if (record.user.email.toLowerCase() === needle) return record.user;
    }
    return undefined;
  }

  findById(id: string): User | undefined {
    return this.records.get(id)?.user;
  }

  create(user: User, passwordHash: string): void {
    this.records.set(user.id, { user, passwordHash });
  }

  getPasswordHash(userId: string): string | undefined {
    return this.records.get(userId)?.passwordHash;
  }

  updatePasswordHash(userId: string, passwordHash: string): void {
    const record = this.records.get(userId);
    if (record) record.passwordHash = passwordHash;
  }
}

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>();

  findAll(): Room[] {
    return [...this.rooms.values()];
  }

  findById(id: string): Room | undefined {
    return this.rooms.get(id);
  }

  findByNameIgnoreCase(name: string): Room | undefined {
    const needle = name.trim().toLowerCase();
    for (const room of this.rooms.values()) {
      if (room.name.toLowerCase() === needle) return room;
    }
    return undefined;
  }

  create(room: Room): void {
    this.rooms.set(room.id, room);
  }

  update(room: Room): void {
    this.rooms.set(room.id, room);
  }
}

export class InMemoryBookingRepository implements BookingRepository {
  private readonly bookings = new Map<string, Booking>();

  findAll(): Booking[] {
    return [...this.bookings.values()];
  }

  findById(id: string): Booking | undefined {
    return this.bookings.get(id);
  }

  findByOrganizerId(organizerId: string): Booking[] {
    return this.findAll().filter((b) => b.organizerId === organizerId);
  }

  create(booking: Booking): void {
    this.bookings.set(booking.id, booking);
  }

  update(booking: Booking): void {
    this.bookings.set(booking.id, booking);
  }
}
