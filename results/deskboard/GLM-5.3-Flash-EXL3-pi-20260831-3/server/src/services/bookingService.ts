import type {
  AvailabilityResponse,
  AvailabilitySlot,
  Booking,
  BookingCreateInput,
  BookingDto,
  Role,
} from '@deskboard/shared';
import {
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  CANCELLATION_WINDOW_MINUTES,
} from '@deskboard/shared';
import type { BookingRepository, RoomRepository } from '../repositories/roomRepository.js';
import type { Clock, IdGen } from './clock.js';
import { DomainError } from './errors.js';
import { assertBookingWindow, overlaps } from './bookingRules.js';

/**
 * Booking business rules (spec §4): business hours, conflicts, capacity,
 * inactive rooms, cancellation window, and computed completion on read.
 * Time comes from the injected `Clock` — never from `Date.now()` directly.
 */
export class BookingService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly rooms: RoomRepository,
    private readonly clock: Clock,
    private readonly ids: IdGen,
  ) {}

  async create(organizerId: string, input: BookingCreateInput): Promise<BookingDto> {
    const room = await this.rooms.findById(input.roomId);
    if (!room) throw new DomainError('NOT_FOUND', 'Room not found');
    if (!room.active) {
      throw new DomainError('ROOM_INACTIVE', 'This room is deactivated and cannot be booked');
    }

    assertBookingWindow(input.start, input.end);

    if (input.attendees > room.capacity) {
      throw new DomainError('CAPACITY_EXCEEDED', 'Attendees exceed the room capacity');
    }

    const sameRoom = await this.bookings.listByRoom(room.id);
    const conflict = sameRoom.find(
      (b) => b.status === 'confirmed' && overlaps(input.start, input.end, b.start, b.end),
    );
    if (conflict) {
      throw new DomainError('ROOM_CONFLICT', 'The room is already booked for an overlapping time', {
        conflictingBookingId: conflict.id,
      });
    }

    const booking: Booking = {
      id: this.ids.next(),
      roomId: room.id,
      title: input.title,
      organizerId,
      start: input.start,
      end: input.end,
      status: 'confirmed',
      attendees: input.attendees,
      createdAt: toMinutes(this.clock.now()),
    };
    const created = await this.bookings.create(booking);
    return this.toDto(created, room);
  }

  async listMine(organizerId: string): Promise<BookingDto[]> {
    const mine = await this.bookings.listByOrganizer(organizerId);
    return Promise.all(mine.map((b) => this.toDto(b)));
  }

  /**
   * Cancel rules (spec §4): the organizer may cancel up to 1h before the start,
   * an admin anytime, anyone else never.
   */
  async cancel(actorId: string, actorRole: Role, bookingId: string): Promise<BookingDto> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw new DomainError('NOT_FOUND', 'Booking not found');

    if (actorRole !== 'admin') {
      if (booking.organizerId !== actorId) {
        throw new DomainError(
          'CANCEL_FORBIDDEN',
          'Only the organizer or an admin can cancel a booking',
        );
      }
      const minutesUntilStart =
        (new Date(booking.start).getTime() - this.clock.now().getTime()) / 60_000;
      if (minutesUntilStart < CANCELLATION_WINDOW_MINUTES) {
        throw new DomainError(
          'CANCELLATION_WINDOW_CLOSED',
          'Cancellations are only possible up to 1 hour before the start',
        );
      }
    }

    const cancelled = await this.bookings.update({ ...booking, status: 'cancelled' });
    return this.toDto(cancelled);
  }

  /** Free/busy grid for one room and calendar date (hourly, business hours). */
  async availability(roomId: string, date: string): Promise<AvailabilityResponse> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new DomainError('NOT_FOUND', 'Room not found');
    const dayBookings = await this.bookings.listByRoom(roomId, date);
    const active = dayBookings.filter((b) => b.status === 'confirmed');

    const slots: AvailabilitySlot[] = [];
    for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
      const start = `${date}T${pad(hour)}:00`;
      const end = `${date}T${pad(hour + 1)}:00`;
      const busy = active.some((b) => overlaps(start, end, b.start, b.end));
      slots.push({ start: `${pad(hour)}:00`, end: `${pad(hour + 1)}:00`, available: !busy });
    }
    return { roomId: room.id, date, slots };
  }

  /**
   * Computed completion (spec §4 `marks_completed_bookings`): confirmed bookings
   * whose end has passed read as `completed`. History is never mutated on read.
   */
  private async toDto(booking: Booking, room?: { name: string } | null): Promise<BookingDto> {
    const resolvedRoom = room ?? (await this.rooms.findById(booking.roomId));
    const status =
      booking.status === 'confirmed' && booking.end < toMinutes(this.clock.now())
        ? 'completed'
        : booking.status;
    return { ...booking, status, roomName: resolvedRoom?.name ?? '' };
  }
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toMinutes(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
