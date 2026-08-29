import type { Booking } from 'shared';
import { InMemoryStore } from './in-memory-store.js';

export interface BookingRepository {
  create(booking: Booking): Promise<Booking>;
  findById(id: string): Promise<Booking | null>;
  update(booking: Booking): Promise<Booking>;
  listForRoom(roomId: string): Promise<Booking[]>;
  listByOrganizer(organizerId: string): Promise<Booking[]>;
  listAll(): Promise<Booking[]>;
}

/** In-memory booking store with the query shapes the services need. */
export class InMemoryBookingRepository implements BookingRepository {
  private readonly store = new InMemoryStore<Booking>();

  async create(booking: Booking): Promise<Booking> {
    return this.store.insert(booking);
  }

  async findById(id: string): Promise<Booking | null> {
    return this.store.get(id);
  }

  async update(booking: Booking): Promise<Booking> {
    return this.store.update(booking);
  }

  async listForRoom(roomId: string): Promise<Booking[]> {
    const all = await this.store.getAll();
    return all.filter((b) => b.roomId === roomId);
  }

  async listByOrganizer(organizerId: string): Promise<Booking[]> {
    const all = await this.store.getAll();
    return all.filter((b) => b.organizerId === organizerId);
  }

  async listAll(): Promise<Booking[]> {
    return this.store.getAll();
  }
}
