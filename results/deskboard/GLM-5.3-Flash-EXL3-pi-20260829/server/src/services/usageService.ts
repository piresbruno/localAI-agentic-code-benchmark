/** Admin usage report: per-room booked hours, booking counts, top organizer. */
import type { UsageReportEntry } from '@deskboard/shared';
import { forbiddenError } from '@deskboard/shared';
import type { BookingRepository, RoomRepository, UserRepository } from '../repositories/types.js';
import { expandOccurrences } from './bookingService.js';

export interface UsageServiceDeps {
  bookings: BookingRepository;
  rooms: RoomRepository;
  users: UserRepository;
}

export class UsageService {
  private readonly bookings: BookingRepository;
  private readonly rooms: RoomRepository;
  private readonly users: UserRepository;

  constructor(deps: UsageServiceDeps) {
    this.bookings = deps.bookings;
    this.rooms = deps.rooms;
    this.users = deps.users;
  }

  /**
   * Per-room usage between `from` and `to` (inclusive, by occurrence start date).
   * Cancelled bookings are excluded. Top organizer is the organizer with the
   * most booked minutes in the window.
   */
  report(actor: { role: string }, from: string, to: string): UsageReportEntry[] {
    if (actor.role !== 'admin') {
      throw forbiddenError('Admin permission required');
    }

    const minutesByRoom = new Map<string, number>();
    const bookingsByRoom = new Map<string, number>();
    const minutesByRoomAndOrganizer = new Map<string, number>();

    for (const booking of this.bookings.findAll()) {
      if (booking.status === 'cancelled') continue;
      for (const occurrence of expandOccurrences(booking.start, booking.end, booking.recurrence)) {
        const date = occurrence.start.slice(0, 10);
        if (date < from || date > to) continue;
        const durationMinutes = durationOf(occurrence.start, occurrence.end);
        minutesByRoom.set(booking.roomId, (minutesByRoom.get(booking.roomId) ?? 0) + durationMinutes);
        bookingsByRoom.set(booking.roomId, (bookingsByRoom.get(booking.roomId) ?? 0) + 1);
        const key = `${booking.roomId}\u0000${booking.organizerId}`;
        minutesByRoomAndOrganizer.set(key, (minutesByRoomAndOrganizer.get(key) ?? 0) + durationMinutes);
      }
    }

    return this.rooms
      .findAll()
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((room) => {
        let topOrganizer: string | null = null;
        let topMinutes = 0;
        for (const [key, minutes] of minutesByRoomAndOrganizer) {
          const [roomId, organizerId] = key.split('\u0000');
          if (roomId === room.id && minutes > topMinutes) {
            topMinutes = minutes;
            topOrganizer = this.users.findById(organizerId)?.name ?? 'Unknown';
          }
        }
        return {
          roomId: room.id,
          roomName: room.name,
          totalBookedMinutes: minutesByRoom.get(room.id) ?? 0,
          bookingCount: bookingsByRoom.get(room.id) ?? 0,
          topOrganizer,
        };
      });
  }
}

function durationOf(start: string, end: string): number {
  const startMinutes = toMinutes(start);
  const endMinutes = toMinutes(end);
  return endMinutes - startMinutes;
}

/** Minutes since midnight of the occurrence's day (occurrences never span days). */
function toMinutes(minute: string): number {
  const h = Number(minute.slice(11, 13));
  const m = Number(minute.slice(14, 16));
  return h * 60 + m;
}
