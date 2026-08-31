import type {
  BookingEntity,
  BookingRepository,
  RoomEntity,
  RoomRepository,
  UserEntity,
  UserRepository,
} from './types';

/**
 * In-memory repositories. A real database would implement the same interfaces
 * (e.g. `PgRoomRepository`) — see README "Swapping the persistence layer".
 */
class MemoryRepository<T extends { id: string }> {
  private rows = new Map<string, T>();
  protected all(): T[] {
    return [...this.rows.values()];
  }
  protected get(id: string): T | undefined {
    return this.rows.get(id);
  }
  protected put(row: T): T {
    this.rows.set(row.id, row);
    return row;
  }
}

export class MemoryUserRepository extends MemoryRepository<UserEntity> implements UserRepository {
  findByEmail(email: string): UserEntity | undefined {
    return this.all().find((u) => u.email === email);
  }
  findById(id: string): UserEntity | undefined {
    return this.get(id);
  }
  create(user: UserEntity): UserEntity {
    return this.put(user);
  }
}

export class MemoryRoomRepository extends MemoryRepository<RoomEntity> implements RoomRepository {
  all(): RoomEntity[] {
    return super.all();
  }
  findById(id: string): RoomEntity | undefined {
    return this.get(id);
  }
  findByName(name: string): RoomEntity | undefined {
    const needle = name.trim().toLowerCase();
    return this.all().find((r) => r.name.trim().toLowerCase() === needle);
  }
  create(room: RoomEntity): RoomEntity {
    return this.put(room);
  }
  update(room: RoomEntity): RoomEntity {
    return this.put(room);
  }
}

export class MemoryBookingRepository
  extends MemoryRepository<BookingEntity>
  implements BookingRepository
{
  findById(id: string): BookingEntity | undefined {
    return this.get(id);
  }
  findByRoom(roomId: string): BookingEntity[] {
    return this.all().filter((b) => b.roomId === roomId);
  }
  findByOrganizer(userId: string): BookingEntity[] {
    return this.all().filter((b) => b.organizerId === userId);
  }
  create(booking: BookingEntity): BookingEntity {
    return this.put(booking);
  }
  update(booking: BookingEntity): BookingEntity {
    return this.put(booking);
  }
}
