/**
 * Booking service — all booking business rules live here (spec §4).
 * Repositories, Clock and IdGen are injected; no framework imports.
 */
import {
  AppError,
  forbidden,
  notFound,
  ruleViolation,
  type Booking,
  type BookingDto,
  type BookingPayload,
  type PublicUser
} from 'deskboard-shared';
import type { BookingRepository, RoomRepository, UserRepository } from '../repositories/types.js';
import type { Clock, IdGen } from './clock.js';
import { addDays, addMinutes, assertWithinBusinessHours } from './time.js';

export interface Actor {
  id: string;
  role: PublicUser['role'];
}

const CANCEL_WINDOW_MINUTES = 60;

export class BookingService {
  readonly #bookings: BookingRepository;
  readonly #rooms: RoomRepository;
  readonly #users: UserRepository;
  readonly #clock: Clock;
  readonly #ids: IdGen;

  constructor(deps: {
    bookings: BookingRepository;
    rooms: RoomRepository;
    users: UserRepository;
    clock: Clock;
    ids: IdGen;
  }) {
    this.#bookings = deps.bookings;
    this.#rooms = deps.rooms;
    this.#users = deps.users;
    this.#clock = deps.clock;
    this.#ids = deps.ids;
  }

  /**
   * Creates a booking, expanding weekly recurrence into occurrences.
   * Conflict in ANY occurrence rejects the whole booking (all-or-nothing).
   */
  create(organizerId: string, input: BookingPayload): BookingDto[] {
    const room = this.#rooms.findById(input.roomId);
    if (!room) throw notFound('Room not found');
    if (!room.active) {
      throw ruleViolation('This room is deactivated and cannot be booked', {
        roomId: room.id
      });
    }
    if (input.attendees > room.capacity) {
      throw ruleViolation(`Room capacity is ${room.capacity}`, {
        capacity: room.capacity,
        attendees: input.attendees
      });
    }

    const count = input.recurrence.kind === 'weekly' ? input.recurrence.count : 1;
    const occurrences = this.#planOccurrences(input, count);
    this.#assertNoConflicts(room.id, occurrences);

    const groupId = this.#ids.next();
    const created = occurrences.map((occ) =>
      this.#bookings.create({
        id: this.#ids.next(),
        groupId,
        roomId: room.id,
        title: input.title,
        organizerId,
        start: occ.start,
        end: occ.end,
        recurrence: input.recurrence,
        status: 'confirmed',
        attendees: input.attendees,
        createdAt: this.#clock.now().toISOString()
      })
    );
    return created.map((b) => this.toDto(b, count > 1 ? count : undefined));
  }

  /** Cancels a booking honoring the cancellation window and role rules. */
  cancel(actor: Actor, bookingId: string): BookingDto {
    const booking = this.#bookings.findById(bookingId);
    if (!booking) throw notFound('Booking not found');

    if (booking.status === 'cancelled') {
      throw new AppError('BOOKING_ALREADY_CANCELLED', 'Booking is already cancelled');
    }
    if (actor.role !== 'admin') {
      if (booking.organizerId !== actor.id) {
        throw forbidden('Only the organizer or an admin can cancel a booking');
      }
      const minutesUntilStart =
        (new Date(booking.start).getTime() - this.#clock.now().getTime()) / 60_000;
      if (minutesUntilStart < CANCEL_WINDOW_MINUTES) {
        throw ruleViolation('Bookings can only be cancelled up to 1 hour before start');
      }
    }
    const updated = this.#bookings.setStatus(bookingId, 'cancelled');
    return this.toDto(updated!);
  }

  /** All bookings of one organizer, soonest first. */
  listMine(organizerId: string): BookingDto[] {
    return this.#bookings
      .list({ organizerId })
      .map((b) => this.toDto(b));
  }

  /**
   * Lists bookings with optional date/room filters.
   * Admins see everyone's bookings; employees only their own.
   */
  list(actor: Actor, query: { date?: string; roomId?: string }): BookingDto[] {
    const organizerId = actor.role === 'admin' ? undefined : actor.id;
    return this.#bookings
      .list({ date: query.date, roomId: query.roomId, organizerId })
      .map((b) => this.toDto(b));
  }

  /** Maps a stored booking to its DTO, computing the status on read. */
  toDto(booking: Booking, seriesCount?: number): BookingDto {
    const { organizerId: _organizerId, ...rest } = booking;
    const organizer = this.#users.findById(booking.organizerId);
    const status =
      booking.status === 'confirmed' && new Date(booking.end).getTime() <= this.#clock.now().getTime()
        ? 'completed'
        : booking.status;
    return {
      ...rest,
      status,
      organizer: organizer
        ? { id: organizer.id, name: organizer.name, email: organizer.email, role: organizer.role }
        : { id: booking.organizerId, name: 'Unknown', email: '', role: 'employee' },
      ...(seriesCount !== undefined ? { seriesCount } : {})
    };
  }

  #planOccurrences(
    input: BookingPayload,
    count: number
  ): { start: string; end: string }[] {
    const occurrences = [];
    for (let i = 0; i < count; i++) {
      const start = i === 0 ? input.start : addDays(input.start, 7 * i);
      const end = addMinutes(start, input.durationMinutes);
      assertWithinBusinessHours(start, end);
      occurrences.push({ start, end });
    }
    return occurrences;
  }

  #assertNoConflicts(roomId: string, occurrences: { start: string; end: string }[]): void {
    for (const occ of occurrences) {
      const clash = this.#bookings.findConfirmedOverlapping(roomId, occ.start, occ.end);
      if (clash.length > 0) {
        throw new AppError('ROOM_CONFLICT', 'The room is already booked for that time', {
          conflictingStart: occ.start,
          conflictingBookingId: clash[0].id
        });
      }
    }
  }
}
