import type { BookingDto, BookingCreateInput, BookingStatus } from '@deskboard/shared';
import type { AuthUser } from '../auth/jwt';
import type { Clock, IdGen } from './clock';
import { conflict, forbidden, notFound, ruleViolation } from './errors';
import type {
  BookingEntity,
  BookingRepository,
  RoomRepository,
  UserRepository,
} from '../repositories/types';
import { toRoomDto } from './room.service';
import { toUserDto } from './auth.service';
import {
  CANCELLATION_WINDOW_MIN,
  MAX_DURATION_MIN,
  isWithinBusinessHours,
  parseLocal,
} from './time';

/**
 * All booking business rules (spec §4): business hours, conflicts, capacity,
 * inactive rooms, cancellation window, computed completion status.
 */
export class BookingService {
  constructor(
    private bookings: BookingRepository,
    private rooms: RoomRepository,
    private users: UserRepository,
    private clock: Clock,
    private ids: IdGen,
  ) {}

  create(actor: AuthUser, input: BookingCreateInput): BookingDto {
    const room = this.rooms.findById(input.roomId);
    if (!room) throw notFound('Room');
    if (!room.active) {
      throw conflict('ROOM_INACTIVE', 'This room is deactivated and cannot be booked.');
    }
    if (input.attendees > room.capacity) {
      throw ruleViolation('OVER_CAPACITY', `Room capacity is ${room.capacity}.`);
    }
    const start = parseLocal(input.start);
    const end = parseLocal(input.end);
    if (end.getTime() <= start.getTime()) {
      throw ruleViolation('INVALID_TIME_RANGE', 'End must be after start.');
    }
    if (end.getTime() - start.getTime() > MAX_DURATION_MIN * 60_000) {
      throw ruleViolation('DURATION_EXCEEDS_LIMIT', 'Bookings are limited to 4 hours.');
    }
    if (!isWithinBusinessHours(start, end)) {
      throw ruleViolation('OUTSIDE_BUSINESS_HOURS', 'Bookings run Mon–Fri, 08:00–19:00.');
    }
    if (this.hasConflict(room.id, start, end)) {
      throw conflict('ROOM_CONFLICT', 'This room is already booked for the selected time.');
    }
    const booking: BookingEntity = {
      id: this.ids.next(),
      roomId: room.id,
      title: input.title,
      organizerId: actor.sub,
      start: input.start,
      end: input.end,
      status: 'confirmed',
      attendees: input.attendees,
      createdAt: this.clock.now().toISOString(),
    };
    return this.toDto(this.bookings.create(booking));
  }

  mine(organizerId: string): BookingDto[] {
    return this.bookings.findByOrganizer(organizerId).map((b) => this.toDto(b));
  }

  /** Organizer up to 1h before start; admin anytime; nobody else (spec §4). */
  cancel(actor: AuthUser, id: string): BookingDto {
    const booking = this.bookings.findById(id);
    if (!booking) throw notFound('Booking');
    if (booking.status === 'cancelled') {
      throw conflict('ALREADY_CANCELLED', 'This booking is already cancelled.');
    }
    const isOrganizer = booking.organizerId === actor.sub;
    if (actor.role !== 'admin') {
      // Non-admins: must be the organizer and still inside the 1h window.
      if (!isOrganizer) {
        throw forbidden('Only the organizer or an admin can cancel this booking.');
      }
      const deadline = parseLocal(booking.start).getTime() - CANCELLATION_WINDOW_MIN * 60_000;
      if (this.clock.now().getTime() > deadline) {
        throw ruleViolation(
          'CANCELLATION_WINDOW_PASSED',
          'Cancellations close 1 hour before the start time.',
        );
      }
    }
    return this.toDto(this.bookings.update({ ...booking, status: 'cancelled' }));
  }

  /** Overlap against confirmed bookings only; adjacency (end == start) allowed. */
  private hasConflict(roomId: string, start: Date, end: Date): boolean {
    return this.bookings.findByRoom(roomId).some((b) => {
      if (b.status !== 'confirmed') return false;
      return start < parseLocal(b.end) && end > parseLocal(b.start);
    });
  }

  /** Maps to the DTO with computed status — history is never mutated on read. */
  toDto(booking: BookingEntity): BookingDto {
    const now = this.clock.now();
    const status: BookingStatus =
      booking.status === 'cancelled'
        ? 'cancelled'
        : parseLocal(booking.end) <= now
          ? 'completed'
          : 'confirmed';
    const room = this.rooms.findById(booking.roomId);
    const organizer = this.users.findById(booking.organizerId);
    return {
      ...booking,
      status,
      roomName: room ? toRoomDto(room).name : 'Unknown room',
      organizerName: organizer ? toUserDto(organizer).name : 'Unknown user',
    };
  }
}
