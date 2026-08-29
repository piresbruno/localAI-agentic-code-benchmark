import type { Room } from 'shared';
import { InMemoryStore } from './in-memory-store.js';

export interface RoomRepository {
  create(room: Room): Promise<Room>;
  findById(id: string): Promise<Room | null>;
  findByDisplayName(name: string): Promise<Room | null>;
  update(room: Room): Promise<Room>;
  listAll(): Promise<Room[]>;
}

/** In-memory room store; name lookups are case-insensitive (business rule). */
export class InMemoryRoomRepository implements RoomRepository {
  private readonly store = new InMemoryStore<Room>();

  async create(room: Room): Promise<Room> {
    return this.store.insert(room);
  }

  async findById(id: string): Promise<Room | null> {
    return this.store.get(id);
  }

  async findByDisplayName(name: string): Promise<Room | null> {
    const needle = name.trim().toLowerCase();
    const rooms = await this.store.getAll();
    return rooms.find((r) => r.name.toLowerCase() === needle) ?? null;
  }

  async update(room: Room): Promise<Room> {
    return this.store.update(room);
  }

  async listAll(): Promise<Room[]> {
    return this.store.getAll();
  }
}
