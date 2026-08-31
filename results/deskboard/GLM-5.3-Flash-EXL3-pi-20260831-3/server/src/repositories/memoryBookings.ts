import type { Booking } from '@deskboard/shared';
import type { BookingRepository } from './roomRepository.js';

/**
 * In-memory booking store. Bookings are stored with their confirmed/cancelled
 * status only — `completed` is computed on read by the service layer.
 */
export class MemoryBookingRepository implements BookingRepository {
  private readonly byId = new Map<string, Booking>();

  async findById(id: string): Promise<Booking | null> {
    return this.byId.get(id) ?? null;
  }

  async listByRoom(roomId: string, date?: string): Promise<Booking[]> {
    const results: Booking[] = [];
    for (const booking of this.byId.values()) {
      if (booking.roomId !== roomId) continue;
      if (date && !booking.start.startsWith(`${date}T`)) continue;
      results.push(booking);
    }
    return results.sort((a, b) => a.start.localeCompare(b.start));
  }

  async listByOrganizer(organizerId: string): Promise<Booking[]> {
    const results: Booking[] = [];
    for (const booking of this.byId.values()) {
      if (booking.organizerId === organizerId) results.push(booking);
    }
    return results.sort((a, b) => a.start.localeCompare(b.start));
  }

  async create(booking: Booking): Promise<Booking> {
    if (this.byId.has(booking.id)) {
      throw new Error(`booking id already exists: ${booking.id}`);
    }
    this.byId.set(booking.id, booking);
    return booking;
  }

  async update(booking: Booking): Promise<Booking> {
    if (!this.byId.has(booking.id)) {
      throw new Error(`unknown booking id: ${booking.id}`);
    }
    this.byId.set(booking.id, booking);
    return booking;
  }
}
