import { AvailabilityDTO, Booking, BUSINESS, ERROR_CODES, SlotDTO } from '@deskboard/shared';
import { BookingRepository, RoomRepository, StoredBooking } from '../repositories/types';
import { AppError } from './errors';
import { Clock, IdGen } from './ports';

export interface CreateBookingCommand {
  roomId: string;
  title: string;
  /** Naive local ISO timestamps with minutes precision, e.g. 2026-09-01T14:30. */
  start: string;
  end: string;
  attendees: number;
}

const MINUTE = 60_000;

/** All booking business rules live here; time and ids are injected. */
export class BookingService {
  constructor(
    private readonly bookings: BookingRepository,
    private readonly rooms: RoomRepository,
    private readonly clock: Clock,
    private readonly ids: IdGen,
  ) {}

  /** Create a booking after running every §4 business rule. */
  async create(organizerId: string, cmd: CreateBookingCommand): Promise<Booking> {
    const room = await this.rooms.findById(cmd.roomId);
    if (!room) throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found');
    if (!room.active) {
      throw new AppError(ERROR_CODES.ROOM_INACTIVE, 'This room is deactivated and cannot be booked');
    }
    const start = this.parseTime(cmd.start, 'start');
    const end = this.parseTime(cmd.end, 'end');
    this.assertBusinessHours(start, end);
    if (cmd.attendees > room.capacity) {
      throw new AppError(
        ERROR_CODES.RULE_VIOLATION,
        `Room capacity is ${room.capacity}; ${cmd.attendees} attendees exceed it`,
      );
    }
    await this.assertNoConflict(room.id, start, end);
    const stored = await this.bookings.create({
      id: this.ids.next(),
      roomId: room.id,
      title: cmd.title,
      organizerId,
      start,
      end,
      status: 'confirmed',
      attendees: cmd.attendees,
      createdAt: this.clock.now(),
    });
    return this.toDTO(stored, room);
  }

  /**
   * Cancel a booking. Organizer: up to 1h before start (inclusive). Admin:
   * anytime. Everyone else: never (403).
   */
  async cancel(userId: string, role: 'admin' | 'employee', bookingId: string): Promise<Booking> {
    const booking = await this.bookings.findById(bookingId);
    if (!booking) throw new AppError(ERROR_CODES.NOT_FOUND, 'Booking not found');
    if (role !== 'admin' && booking.organizerId !== userId) {
      throw new AppError(ERROR_CODES.FORBIDDEN, 'Only the organizer or an admin can cancel a booking');
    }
    if (booking.status === 'cancelled') {
      throw new AppError(ERROR_CODES.RULE_VIOLATION, 'Booking is already cancelled');
    }
    if (role !== 'admin') {
      const deadline = booking.start.getTime() - BUSINESS.CANCEL_WINDOW_MIN * MINUTE;
      if (this.clock.now().getTime() > deadline) {
        throw new AppError(
          ERROR_CODES.RULE_VIOLATION,
          'Cancellations must happen at least 1 hour before the start',
        );
      }
    }
    booking.status = 'cancelled';
    const updated = await this.bookings.update(booking);
    return this.toDTO(updated, await this.rooms.findById(booking.roomId));
  }

  /** The organizer's bookings, oldest first, with computed status. */
  async listMine(organizerId: string): Promise<Booking[]> {
    const stored = await this.bookings.listByOrganizer(organizerId);
    const out: Booking[] = [];
    for (const booking of stored) {
      out.push(this.toDTO(booking, await this.rooms.findById(booking.roomId)));
    }
    return out;
  }

  /** Free/busy grid for one room on a local calendar day, hourly 08:00–19:00. */
  async availability(roomId: string, date: string): Promise<AvailabilityDTO> {
    const room = await this.rooms.findById(roomId);
    if (!room) throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found');
    const [y, m, d] = date.split('-').map(Number);
    const dayStart = new Date(y, m - 1, d, 0, 0);
    const dayEnd = new Date(y, m - 1, d + 1, 0, 0);
    const active = (await this.bookings.listByRoom(roomId)).filter(
      (b) => b.status !== 'cancelled' && b.start < dayEnd && b.end > dayStart,
    );
    const slots: SlotDTO[] = [];
    for (let hour = BUSINESS.OPEN_HOUR; hour < BUSINESS.CLOSE_HOUR; hour++) {
      const slotStart = new Date(y, m - 1, d, hour);
      const slotEnd = new Date(y, m - 1, d, hour + 1);
      const hit = active.find((b) => b.start < slotEnd && slotStart < b.end);
      slots.push({
        start: hhmm(hour, 0),
        end: hhmm(hour + 1, 0),
        available: !hit,
        ...(hit ? { bookingId: hit.id, title: hit.title } : {}),
      });
    }
    return { roomId, date, slots };
  }

  private parseTime(value: string, field: 'start' | 'end'): Date {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      throw new AppError(ERROR_CODES.VALIDATION, `${field} is not a valid timestamp`);
    }
    return parsed;
  }

  private assertBusinessHours(start: Date, end: Date): void {
    const day = start.getDay();
    if (day < 1 || day > 5) {
      throw new AppError(ERROR_CODES.RULE_VIOLATION, 'Bookings are allowed Monday to Friday only');
    }
    if (end.getTime() <= start.getTime()) {
      throw new AppError(ERROR_CODES.RULE_VIOLATION, 'End must be after start');
    }
    const durationMin = (end.getTime() - start.getTime()) / MINUTE;
    if (durationMin > BUSINESS.MAX_DURATION_MIN) {
      throw new AppError(ERROR_CODES.RULE_VIOLATION, 'Bookings may last at most 4 hours');
    }
    if (minutesOfDay(start) < BUSINESS.OPEN_HOUR * 60) {
      throw new AppError(ERROR_CODES.RULE_VIOLATION, 'Bookings may start at 08:00 at the earliest');
    }
    if (minutesOfDay(end) > BUSINESS.CLOSE_HOUR * 60) {
      throw new AppError(ERROR_CODES.RULE_VIOLATION, 'Bookings must end at 19:00 at the latest');
    }
  }

  private async assertNoConflict(roomId: string, start: Date, end: Date): Promise<void> {
    const roomBookings = await this.bookings.listByRoom(roomId);
    const clash = roomBookings.find(
      (b) => b.status !== 'cancelled' && start < b.end && end > b.start,
    );
    if (clash) {
      throw new AppError(ERROR_CODES.ROOM_CONFLICT, 'Room is already booked for the requested time');
    }
  }

  private toDTO(stored: StoredBooking, room: Room | undefined): Booking {
    const now = this.clock.now();
    const status =
      stored.status === 'cancelled'
        ? 'cancelled'
        : stored.end.getTime() <= now.getTime()
          ? 'completed'
          : 'confirmed';
    return {
      id: stored.id,
      roomId: stored.roomId,
      roomName: room?.name ?? 'Unknown room',
      title: stored.title,
      organizerId: stored.organizerId,
      start: stored.start.toISOString(),
      end: stored.end.toISOString(),
      status,
      attendees: stored.attendees,
      createdAt: stored.createdAt.toISOString(),
    };
  }
}

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

function hhmm(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}
