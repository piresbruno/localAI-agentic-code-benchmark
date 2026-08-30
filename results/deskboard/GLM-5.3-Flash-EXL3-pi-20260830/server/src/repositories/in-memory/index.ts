import type {
  Booking,
  BookingStatus,
  Room
} from 'deskboard-shared';
import type {
  BookingQuery,
  BookingRepository,
  RoomRepository,
  StoredUser,
  UserRepository
} from '../types.js';

/**
 * In-memory implementations of the repository ports. A real database adapter
 * implements the same interfaces (see README "Persistence" section).
 */

export class InMemoryUserRepository implements UserRepository {
  #users = new Map<string, StoredUser>();

  create(user: StoredUser): StoredUser {
    this.#users.set(user.id, { ...user });
    return { ...user };
  }

  findById(id: string): StoredUser | null {
    const u = this.#users.get(id);
    return u ? { ...u } : null;
  }

  findByEmail(email: string): StoredUser | null {
    const target = email.toLowerCase();
    for (const u of this.#users.values()) {
      if (u.email === target) return { ...u };
    }
    return null;
  }

  updatePasswordHash(id: string, passwordHash: string): StoredUser | null {
    const u = this.#users.get(id);
    if (!u) return null;
    u.passwordHash = passwordHash;
    return { ...u };
  }
}

export class InMemoryRoomRepository implements RoomRepository {
  #rooms = new Map<string, Room>();

  create(room: Room): Room {
    this.#rooms.set(room.id, { ...room, features: [...room.features] });
    return this.findById(room.id)!;
  }

  findById(id: string): Room | null {
    const r = this.#rooms.get(id);
    return r ? { ...r, features: [...r.features] } : null;
  }

  findByNameIgnoreCase(name: string): Room | null {
    const target = name.toLowerCase();
    for (const r of this.#rooms.values()) {
      if (r.name.toLowerCase() === target) return this.findById(r.id)!;
    }
    return null;
  }

  list(): Room[] {
    return [...this.#rooms.values()]
      .map((r) => this.findById(r.id)!)
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  save(room: Room): Room {
    if (!this.#rooms.has(room.id)) return null as never;
    this.#rooms.set(room.id, { ...room, features: [...room.features] });
    return this.findById(room.id)!;
  }
}

export class InMemoryBookingRepository implements BookingRepository {
  #bookings = new Map<string, Booking>();

  create(booking: Booking): Booking {
    this.#bookings.set(booking.id, { ...booking, recurrence: { ...booking.recurrence } });
    return { ...booking };
  }

  findById(id: string): Booking | null {
    const b = this.#bookings.get(id);
    return b ? { ...b, recurrence: { ...b.recurrence } } : null;
  }

  findConfirmedOverlapping(roomId: string, start: string, end: string): Booking[] {
    // ISO local datetimes of the same format compare correctly as strings.
    return [...this.#bookings.values()].filter(
      (b) =>
        b.roomId === roomId &&
        b.status !== 'cancelled' &&
        b.start < end &&
        b.end > start
    );
  }

  list(query: BookingQuery): Booking[] {
    let result = [...this.#bookings.values()];
    if (query.roomId) result = result.filter((b) => b.roomId === query.roomId);
    if (query.organizerId) result = result.filter((b) => b.organizerId === query.organizerId);
    if (query.date) result = result.filter((b) => b.start.startsWith(query.date!));
    if (query.fromStart) result = result.filter((b) => b.start >= query.fromStart!);
    if (query.toStart) result = result.filter((b) => b.start <= query.toStart!);
    return result
      .map((b) => ({ ...b, recurrence: { ...b.recurrence } }))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  setStatus(id: string, status: BookingStatus): Booking | null {
    const b = this.#bookings.get(id);
    if (!b) return null;
    b.status = status;
    return { ...b, recurrence: { ...b.recurrence } };
  }
}
