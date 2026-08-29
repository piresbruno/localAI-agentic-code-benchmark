/**
 * UsageService — admin usage report: per room, booked hours + booking count in
 * a [from, to] range (cancelled bookings excluded) and the top organizer.
 */
import type { CalendarDate, UsageResponse, UsageRoomRow } from 'shared';
import { DomainError } from 'shared';
import type { BookingRepository } from '../repositories/booking-repository.js';
import type { RoomRepository } from '../repositories/room-repository.js';
import type { UserRepository } from '../repositories/user-repository.js';
import { addDays, startOfLocalDay, intervalOverlap, parseIso } from './time.js';
import type { Caller } from './booking-service.js';

export interface UsageServiceDeps {
  bookings: BookingRepository;
  rooms: RoomRepository;
  users: UserRepository;
}

export class UsageService {
  constructor(private readonly deps: UsageServiceDeps) {}

  async getUsage(from?: CalendarDate, to?: CalendarDate, caller?: Caller): Promise<UsageResponse> {
    if (caller && caller.role !== 'admin') {
      throw new DomainError('FORBIDDEN', 'Admin role required for usage reports');
    }

    const start = startOfLocalDay(from ?? this.daysAgo(30));
    const end = addDays(startOfLocalDay(to ?? this.today()), 1); // exclusive

    const [rooms, allBookings, users] = await Promise.all([
      this.deps.rooms.listAll(),
      this.deps.bookings.listAll(),
      this.deps.users.list(),
    ]);
    const emails = new Map(users.map((u) => [u.id, u.email]));

    const rows: UsageRoomRow[] = rooms
      .map((room) => {
        const relevant = allBookings.filter((b) => b.roomId === room.id && b.status !== 'cancelled');
        let bookedMinutes = 0;
        let count = 0;
        const organizerCounts = new Map<string, number>();
        for (const booking of relevant) {
          const bStart = parseIso(booking.start);
          const bEnd = parseIso(booking.end);
          if (intervalOverlap({ start: bStart, end: bEnd }, { start, end })) {
            const overlapStart = bStart.getTime() > start.getTime() ? bStart : start;
            const overlapEnd = bEnd.getTime() < end.getTime() ? bEnd : end;
            bookedMinutes += Math.max(0, overlapEnd.getTime() - overlapStart.getTime()) / 60_000;
            count += 1;
            organizerCounts.set(booking.organizerId, (organizerCounts.get(booking.organizerId) ?? 0) + 1);
          }
        }
        const topOrganizer = this.topOrganizer(organizerCounts, emails);
        return {
          roomId: room.id,
          roomName: room.name,
          bookedHours: Math.round((bookedMinutes / 60) * 10) / 10,
          bookings: count,
          topOrganizer,
        };
      })
      // Deterministic order: floor / name is not available here, use name.
      .sort((a, b) => a.roomName.localeCompare(b.roomName));

    return { from: from ?? this.daysAgo(30), to: to ?? this.today(), rooms: rows };
  }

  private topOrganizer(counts: Map<string, number>, emails: Map<string, string>): UsageRoomRow['topOrganizer'] {
    if (counts.size === 0) return null;
    const userId = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]![0];
    return { email: emails.get(userId) ?? userId, bookings: counts.get(userId)! };
  }

  private today(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  private daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
}
