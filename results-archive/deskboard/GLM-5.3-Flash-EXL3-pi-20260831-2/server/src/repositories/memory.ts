import { Room } from '@deskboard/shared';
import {
  BookingRepository,
  RoomRepository,
  StoredBooking,
  StoredUser,
  UserRepository,
} from './types';

/**
 * In-memory persistence behind the repository interfaces. A real database
 * adapter would implement the same interfaces — see README "Persistence".
 */
export class MemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, StoredUser>();
  private readonly byEmail = new Map<string, StoredUser>();

  async findByEmail(email: string): Promise<StoredUser | undefined> {
    return this.byEmail.get(email.toLowerCase());
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    return this.byId.get(id);
  }

  async create(user: StoredUser): Promise<StoredUser> {
    const stored = { ...user, email: user.email.toLowerCase() };
    this.byId.set(stored.id, stored);
    this.byEmail.set(stored.email, stored);
    return stored;
  }
}

export class MemoryRoomRepository implements RoomRepository {
  private readonly byId = new Map<string, Room>();

  async list(): Promise<Room[]> {
    return [...this.byId.values()];
  }

  async findById(id: string): Promise<Room | undefined> {
    return this.byId.get(id);
  }

  async findByNameIgnoreCase(name: string): Promise<Room | undefined> {
    const needle = name.toLowerCase();
    return [...this.byId.values()].find((room) => room.name.toLowerCase() === needle);
  }

  async create(room: Room): Promise<Room> {
    this.byId.set(room.id, room);
    return room;
  }

  async update(room: Room): Promise<Room> {
    this.byId.set(room.id, room);
    return room;
  }
}

export class MemoryBookingRepository implements BookingRepository {
  private readonly byId = new Map<string, StoredBooking>();

  async create(booking: StoredBooking): Promise<StoredBooking> {
    this.byId.set(booking.id, booking);
    return booking;
  }

  async findById(id: string): Promise<StoredBooking | undefined> {
    return this.byId.get(id);
  }

  async update(booking: StoredBooking): Promise<StoredBooking> {
    this.byId.set(booking.id, booking);
    return booking;
  }

  async listByRoom(roomId: string): Promise<StoredBooking[]> {
    return [...this.byId.values()].filter((booking) => booking.roomId === roomId);
  }

  async listByOrganizer(organizerId: string): Promise<StoredBooking[]> {
    return [...this.byId.values()]
      .filter((booking) => booking.organizerId === organizerId)
      .sort((a, b) => a.start.getTime() - b.start.getTime());
  }
}
