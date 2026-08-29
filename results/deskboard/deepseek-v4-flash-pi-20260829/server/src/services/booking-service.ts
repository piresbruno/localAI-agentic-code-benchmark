/**
 * BookingService — every booking business rule lives here:
 *  - business hours (Mon–Fri 08:00–19:00 local, end > start, ≤ 4h)
 *  - weekly recurrence expansion (all-or-nothing)
 *  - room conflict detection (any occurrence)
 *  - capacity, deactivated rooms, past-start guard
 *  - cancellation window + ownership
 *  - completed-on-read
 */
import type { Booking, BookingCreateInput, BookingResponse, Recurrence, Role } from 'shared';
import { CANCELLATION_WINDOW_MINUTES, DomainError, MAX_BOOKING_HOURS } from 'shared';
import type { Clock, IdGen } from '../ports.js';
import type { BookingRepository } from '../repositories/booking-repository.js';
import type { RoomRepository } from '../repositories/room-repository.js';
import { addDays, addMinutes, intervalOverlap, isWithinBusinessWindow, parseIso } from './time.js';

export interface Caller {
  id: string;
  role: Role;
}

export interface BookingServiceDeps {
  bookings: BookingRepository;
  rooms: RoomRepository;
  clock: Clock;
  idGen: IdGen;
}

interface Occurrence {
  start: Date;
  end: Date;
}

/** Expand a recurrence into concrete occurrences, 7 days apart. */
export function expandOccurrences(start: Date, durationMinutes: number, recurrence: Recurrence): Occurrence[] {
  const count = recurrence.kind === 'weekly' ? recurrence.count : 1;
  const occurrences: Occurrence[] = [];
  for (let i = 0; i < count; i++) {
    const occStart = addDays(start, i * 7);
    occurrences.push({ start: occStart, end: addMinutes(occStart, durationMinutes) });
  }
  return occurrences;
}

export function expandRecurrence(
  startIso: string,
  durationMinutes: number,
  recurrence: Recurrence,
): Occurrence[] {
  return expandOccurrences(parseIso(startIso), durationMinutes, recurrence);
}

/** Compute the read-time status: past confirmed bookings read as 'completed'. */
export function effectiveStatus(booking: Pick<Booking, 'status' | 'end'>, now: Date): Booking['status'] | 'completed' {
  if (booking.status === 'cancelled') return 'cancelled';
  if (parseIso(booking.end).getTime() <= now.getTime()) return 'completed';
  return 'confirmed';
}

export class BookingService {
  constructor(private readonly deps: BookingServiceDeps) {}

  private async assertRoomBookable(roomId: string, attendees: number) {
    const room = await this.deps.rooms.findById(roomId);
    if (!room) throw new DomainError('NOT_FOUND', 'Room not found');
    if (!room.active) throw new DomainError('RULE_VIOLATION', 'Room is deactivated and cannot be booked');
    if (attendees > room.capacity) {
      throw new DomainError(
        'RULE_VIOLATION',
        `Attendees (${attendees}) exceed room capacity (${room.capacity})`,
        { attendees, capacity: room.capacity },
      );
    }
    return room;
  }

  /** All named booking rules validated up front; throws on the first violation. */
  private assertValidBooking(startIso: string, durationMinutes: number, recurrence: Recurrence): Occurrence[] {
    if (durationMinutes > MAX_BOOKING_HOURS * 60) {
      throw new DomainError('RULE_VIOLATION', `Bookings cannot exceed ${MAX_BOOKING_HOURS} hours`);
    }
    const occurrences = expandRecurrence(startIso, durationMinutes, recurrence);
    const now = this.deps.clock.now();

    for (const occ of occurrences) {
      if (occ.end.getTime() <= occ.start.getTime()) {
        throw new DomainError('RULE_VIOLATION', 'Booking end must be after its start');
      }
      if (!isWithinBusinessWindow(occ.start, occ.end)) {
        throw new DomainError(
          'RULE_VIOLATION',
          'Bookings are only allowed Mon–Fri between 08:00 and 19:00 (local time)',
        );
      }
      if (occ.start.getTime() < now.getTime()) {
        throw new DomainError('RULE_VIOLATION', 'Bookings cannot start in the past');
      }
    }
    return occurrences;
  }

  private async assertNoConflict(roomId: string, occurrences: Occurrence[]) {
    const existing = (await this.deps.bookings.listForRoom(roomId)).filter((b) => b.status !== 'cancelled');
    for (const occ of occurrences) {
      for (const booking of existing) {
        const bStart = parseIso(booking.start);
        const bEnd = parseIso(booking.end);
        if (intervalOverlap(occ, { start: bStart, end: bEnd })) {
          throw new DomainError('ROOM_CONFLICT', 'The room is already booked during this time', {
            roomId,
            conflictWith: booking.id,
            start: occ.start.toISOString(),
            end: occ.end.toISOString(),
          });
        }
      }
    }
  }

  async create(input: BookingCreateInput, organizerId: string): Promise<BookingResponse[]> {
    const room = await this.assertRoomBookable(input.roomId, input.attendees);
    const occurrences = this.assertValidBooking(input.start, input.durationMinutes, input.recurrence);
    await this.assertNoConflict(input.roomId, occurrences);

    const now = this.deps.clock.now();
    const createdAt = now.toISOString();
    const created: Booking[] = [];
    for (const occ of occurrences) {
      const booking: Booking = {
        id: this.deps.idGen.next(),
        roomId: input.roomId,
        title: input.title,
        organizerId,
        start: occ.start.toISOString(),
        end: occ.end.toISOString(),
        recurrence: input.recurrence,
        status: 'confirmed',
        attendees: input.attendees,
        createdAt,
      };
      created.push(await this.deps.bookings.create(booking));
    }
    return created.map((b) => this.toResponse(b, room.name));
  }

  /** Cancel a booking. Organizer up to 1h before start; admin anytime; others never. */
  async cancel(bookingId: string, caller: Caller): Promise<BookingResponse> {
    const booking = await this.deps.bookings.findById(bookingId);
    if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');
    if (booking.status === 'cancelled') {
      throw new DomainError('BOOKING_NOT_ACTIVE', 'Booking is already cancelled');
    }

    const isOrganizer = booking.organizerId === caller.id;
    const isAdmin = caller.role === 'admin';
    if (!isOrganizer && !isAdmin) {
      throw new DomainError('FORBIDDEN', 'Only the organizer or an admin can cancel this booking');
    }
    if (!isAdmin) {
      const start = parseIso(booking.start);
      const windowOpensAt = addMinutes(start, -CANCELLATION_WINDOW_MINUTES);
      if (this.deps.clock.now().getTime() >= windowOpensAt.getTime()) {
        throw new DomainError(
          'RULE_VIOLATION',
          `Cancellation window closed: bookings can be cancelled up to ${CANCELLATION_WINDOW_MINUTES} minutes before start`,
        );
      }
    }

    const updated: Booking = { ...booking, status: 'cancelled' };
    await this.deps.bookings.update(updated);
    const room = await this.deps.rooms.findById(booking.roomId);
    return this.toResponse(updated, room?.name ?? '');
  }

  async listMine(organizerId: string): Promise<BookingResponse[]> {
    const bookings = await this.deps.bookings.listByOrganizer(organizerId);
    return this.withRoomNames(bookings);
  }

  /** Admin: all bookings (optionally filtered); employee: only own. Date filter = local day. */
  async list(caller: Caller, filter?: { date?: string; roomId?: string }): Promise<BookingResponse[]> {
    const bookings =
      caller.role === 'admin' ? await this.deps.bookings.listAll() : await this.deps.bookings.listByOrganizer(caller.id);

    const filtered = bookings.filter((b) => {
      if (filter?.roomId && b.roomId !== filter.roomId) return false;
      if (filter?.date) {
        const dayStart = new Date(`${filter.date}T00:00:00`);
        const dayEnd = addDays(dayStart, 1);
        const bStart = parseIso(b.start);
        if (!(bStart.getTime() < dayEnd.getTime() && dayStart.getTime() < parseIso(b.end).getTime())) return false;
      }
      return true;
    });
    return this.withRoomNames(filtered);
  }

  async getAvailability(roomId: string, date: string): Promise<{ slots: ReturnType<typeof this.slotFor>[]; roomName: string }> {
    const room = await this.deps.rooms.findById(roomId);
    if (!room) throw new DomainError('NOT_FOUND', 'Room not found');

    const active = (await this.deps.bookings.listForRoom(roomId)).filter((b) => b.status !== 'cancelled');

    const slots = [];
    for (let hour = 8; hour < 19; hour++) {
      slots.push(this.slotFor(hour, date, active));
    }
    return { slots, roomName: room.name };
  }

  /** Build a one-hour availability slot, marking it busy when any booking overlaps. */
  private slotFor(hour: number, date: string, active: Booking[]) {
    const slotStart = new Date(`${date}T${String(hour).padStart(2, '0')}:00:00`);
    const slotEnd = addMinutes(slotStart, 60);
    const occupying = active
      .filter((b) =>
        intervalOverlap({ start: parseIso(b.start), end: parseIso(b.end) }, { start: slotStart, end: slotEnd }),
      )
      .map((b) => ({
        id: b.id,
        title: b.title,
        status: effectiveStatus(b, this.deps.clock.now()),
        organizerId: b.organizerId,
      }));
    return {
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
      status: occupying.length > 0 ? 'busy' : 'free',
      bookings: occupying,
    } as const;
  }

  private async withRoomNames(bookings: Booking[]): Promise<BookingResponse[]> {
    const rooms = await this.deps.rooms.listAll();
    const names = new Map(rooms.map((r) => [r.id, r.name]));
    return bookings
      .map((b) => this.toResponse(b, names.get(b.roomId) ?? ''))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  private toResponse(booking: Booking, roomName: string): BookingResponse {
    return {
      id: booking.id,
      roomId: booking.roomId,
      roomName,
      title: booking.title,
      organizerId: booking.organizerId,
      start: booking.start,
      end: booking.end,
      recurrence: booking.recurrence,
      status: effectiveStatus(booking, this.deps.clock.now()),
      attendees: booking.attendees,
      createdAt: booking.createdAt,
    };
  }
}
