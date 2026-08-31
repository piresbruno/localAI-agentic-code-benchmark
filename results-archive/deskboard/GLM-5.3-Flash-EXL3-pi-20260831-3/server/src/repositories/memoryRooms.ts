import type { Room } from '@deskboard/shared';
import type { RoomRepository } from './roomRepository.js';

/** In-memory room store. Names are unique, case-insensitive. */
export class MemoryRoomRepository implements RoomRepository {
  private readonly byId = new Map<string, Room>();

  async findById(id: string): Promise<Room | null> {
    return this.byId.get(id) ?? null;
  }

  async findByName(name: string): Promise<Room | null> {
    const wanted = name.trim().toLowerCase();
    for (const room of this.byId.values()) {
      if (room.name.toLowerCase() === wanted) return room;
    }
    return null;
  }

  async list(): Promise<Room[]> {
    return [...this.byId.values()];
  }

  async create(room: Room): Promise<Room> {
    if (this.byId.has(room.id)) {
      throw new Error(`room id already exists: ${room.id}`);
    }
    this.byId.set(room.id, room);
    return room;
  }

  async update(room: Room): Promise<Room> {
    if (!this.byId.has(room.id)) {
      throw new Error(`unknown room id: ${room.id}`);
    }
    this.byId.set(room.id, room);
    return room;
  }
}
