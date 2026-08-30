/**
 * Usage reporting for admins: per-room booked hours, booking count and
 * top organizer over a date range (inclusive).
 */
import {
  forbidden,
  type PublicUser,
  type UsageReport
} from 'deskboard-shared';
import type { BookingRepository, RoomRepository, UserRepository } from '../repositories/types.js';
import { durationMinutes } from './time.js';

export class UsageService {
  readonly #rooms: RoomRepository;
  readonly #bookings: BookingRepository;
  readonly #users: UserRepository;

  constructor(deps: {
    rooms: RoomRepository;
    bookings: BookingRepository;
    users: UserRepository;
  }) {
    this.#rooms = deps.rooms;
    this.#bookings = deps.bookings;
    this.#users = deps.users;
  }

  report(actor: { role: PublicUser['role'] }, from: string, to: string): UsageReport {
    if (actor.role !== 'admin') throw forbidden('Only admins can view usage reports');
    const fromStart = `${from}T00:00`;
    const toEnd = `${to}T23:59`;
    const rooms = this.#rooms.list().map((room) => {
      // Cancelled bookings do not count as usage; completed ones do.
      const bookings = this.#bookings
        .list({ roomId: room.id, fromStart, toStart: toEnd })
        .filter((b) => b.status !== 'cancelled');
      const hoursByOrganizer = new Map<string, number>();
      let totalHours = 0;
      for (const b of bookings) {
        const hours = durationMinutes(b.start, b.end) / 60;
        totalHours += hours;
        hoursByOrganizer.set(
          b.organizerId,
          (hoursByOrganizer.get(b.organizerId) ?? 0) + hours
        );
      }
      let topOrganizer: UsageReport['rooms'][number]['topOrganizer'] = null;
      for (const [organizerId, hours] of hoursByOrganizer) {
        if (!topOrganizer || hours > topOrganizer.hours) {
          const user = this.#users.findById(organizerId);
          topOrganizer = { name: user?.name ?? 'Unknown', hours };
        }
      }
      return {
        room,
        totalHours: Math.round(totalHours * 100) / 100,
        bookingCount: bookings.length,
        topOrganizer
      };
    });
    return { from, to, rooms };
  }
}
