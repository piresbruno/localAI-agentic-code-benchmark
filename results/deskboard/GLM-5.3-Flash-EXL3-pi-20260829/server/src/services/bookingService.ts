/**
 * Booking business rules: business hours, conflict detection, recurrence
 * expansion, capacity limits, cancellation window, computed status.
 *
 * All time handling works on local office time ("YYYY-MM-DDTHH:mm" strings,
 * parsed without timezone conversion) because the spec's business hours are local.
 */
import type { Booking, BookingOccurrence, BookingView, PublicUser, RecurrenceSpec, RoomAvailability } from '@deskboard/shared';
import {
  forbiddenError,
  notFoundError,
  roomConflictError,
  ruleViolationError,
  validationError,
} from '@deskboard/shared';
import type { BookingRepository, RoomRepository, UserRepository } from '../repositories/types.js';
import type { Clock, IdGen } from './clock.js';

/** Office business hours: Mon–Fri, 08:00–19:00 local. */
export const BUSINESS_START_MINUTES = 8 * 60;
export const BUSINESS_END_MINUTES = 19 * 60;
/** Maximum booking duration in minutes. */
export const MAX_DURATION_MINUTES = 4 * 60;
/** Organizer cancellation window: up to 1 hour before the start. */
export const CANCELLATION_WINDOW_MINUTES = 60;

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Parses "YYYY-MM-DDTHH:mm" as local time. Throws VALIDATION_FAILED on malformed input. */
export function parseMinute(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) throw validationError(`Invalid datetime: ${value}`);
  const [, y, mo, d, h, mi] = match.map(Number) as unknown as number[];
  const date = new Date(y, mo - 1, d, h, mi);
  if (Number.isNaN(date.getTime()) || formatMinute(date) !== value) {
    throw validationError(`Invalid datetime: ${value}`);
  }
  return date;
}

/** Formats a Date back to "YYYY-MM-DDTHH:mm" in local time. */
export function formatMinute(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

/** Local date part "YYYY-MM-DD" of a minute string. */
export function datePart(minute: string): string {
  return minute.slice(0, 10);
}

/** Expands the recurrence spec into concrete occurrences (first + weekly repeats). */
export function expandOccurrences(start: string, end: string, recurrence: RecurrenceSpec): BookingOccurrence[] {
  const first: BookingOccurrence = { start, end };
  if (recurrence.kind !== 'weekly') return [first];
  const occurrences: BookingOccurrence[] = [first];
  let cursorStart = parseMinute(start);
  let cursorEnd = parseMinute(end);
  for (let i = 1; i < recurrence.count; i++) {
    cursorStart = addDays(cursorStart, 7);
    cursorEnd = addDays(cursorEnd, 7);
    occurrences.push({ start: formatMinute(cursorStart), end: formatMinute(cursorEnd) });
  }
  return occurrences;
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** True when two half-open intervals [aStart, aEnd) and [bStart, bEnd) overlap. Adjacent intervals do not. */
export function intervalsOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Business-hours rule for one occurrence: Mon–Fri only, within 08:00–19:00,
 * end strictly after start, duration ≤ 4h.
 */
export function assertOccurrenceWithinBusinessHours(occurrence: BookingOccurrence): void {
  const start = parseMinute(occurrence.start);
  const end = parseMinute(occurrence.end);

  if (end.getTime() <= start.getTime()) {
    throw ruleViolationError('Booking end must be after the start');
  }
  const durationMinutes = (end.getTime() - start.getTime()) / 60_000;
  if (durationMinutes > MAX_DURATION_MINUTES) {
    throw ruleViolationError('Bookings may last at most 4 hours');
  }
  const day = start.getDay();
  if (day === 0 || day === 6) {
    throw ruleViolationError(`Bookings are only allowed Monday to Friday (got ${DAY_NAMES[day]})`);
  }
  const startMinutes = start.getHours() * 60 + start.getMinutes();
  const endMinutes = end.getHours() * 60 + end.getMinutes();
  // An occurrence ending at midnight-ish (duration cap makes this impossible beyond 19:00+4h) is
  // still covered by the wall-clock checks below because a booking may not span days.
  if (startMinutes < BUSINESS_START_MINUTES) {
    throw ruleViolationError('Bookings may not start before 08:00');
  }
  if (endMinutes > BUSINESS_END_MINUTES || endMinutes <= startMinutes) {
    throw ruleViolationError('Bookings must end by 19:00');
  }
}

/** Computes the displayed status: cancelled stays, past bookings read as completed — history is never mutated. */
export function computedStatus(booking: Booking, occurrences: BookingOccurrence[], now: Date): Booking['status'] {
  if (booking.status === 'cancelled') return 'cancelled';
  const lastEnd = occurrences.reduce((max, o) => (o.end > max ? o.end : max), occurrences[0]?.end ?? booking.end);
  return lastEnd <= formatMinute(now) ? 'completed' : 'confirmed';
}

export interface CreateBookingInput {
  roomId: string;
  title: string;
  start: string;
  end: string;
  attendees: number;
  recurrence: RecurrenceSpec;
}

export interface BookingServiceDeps {
  bookings: BookingRepository;
  rooms: RoomRepository;
  users: UserRepository;
  clock: Clock;
  idGen: IdGen;
}

export class BookingService {
  private readonly bookings: BookingRepository;
  private readonly rooms: RoomRepository;
  private readonly users: UserRepository;
  private readonly clock: Clock;
  private readonly idGen: IdGen;

  constructor(deps: BookingServiceDeps) {
    this.bookings = deps.bookings;
    this.rooms = deps.rooms;
    this.users = deps.users;
    this.clock = deps.clock;
    this.idGen = deps.idGen;
  }

  /**
   * Creates a booking after enforcing every business rule:
   * room exists + active, business hours, capacity, no conflicts (any occurrence).
   */
  create(actor: PublicUser, input: CreateBookingInput): BookingView {
    const room = this.rooms.findById(input.roomId);
    if (!room) throw notFoundError('Room not found');
    if (!room.active) {
      throw ruleViolationError('This room is deactivated and cannot be booked');
    }

    const occurrences = expandOccurrences(input.start, input.end, input.recurrence);
    for (const occurrence of occurrences) {
      assertOccurrenceWithinBusinessHours(occurrence);
    }

    if (input.attendees > room.capacity) {
      throw ruleViolationError(
        `Room capacity is ${room.capacity}, but ${input.attendees} attendees were requested`,
      );
    }

    const conflict = this.findConflict(room.id, occurrences);
    if (conflict) {
      throw roomConflictError(
        `The room is already booked between ${conflict.start} and ${conflict.end}`,
        { conflictingOccurrence: conflict },
      );
    }

    const booking: Booking = {
      id: this.idGen.next(),
      roomId: room.id,
      title: input.title.trim(),
      organizerId: actor.id,
      start: input.start,
      end: input.end,
      recurrence: input.recurrence,
      status: 'confirmed',
      attendees: input.attendees,
      createdAt: this.clock.now().toISOString(),
    };
    this.bookings.create(booking);
    return this.toView(booking);
  }

  /** The caller's own bookings, earliest first. */
  listMine(actor: PublicUser): BookingView[] {
    return this.bookings
      .findByOrganizerId(actor.id)
      .map((b) => this.toView(b))
      .sort((a, b) => a.start.localeCompare(b.start));
  }

  /**
   * Lists bookings with optional `date` (YYYY-MM-DD) and `roomId` filters.
   * Admins see everyone's bookings; employees only their own.
   */
  list(actor: PublicUser, filters: { date?: string; roomId?: string }): BookingView[] {
    let candidates = actor.role === 'admin' ? this.bookings.findAll() : this.bookings.findByOrganizerId(actor.id);
    const views = candidates.map((b) => this.toView(b));
    const filtered = views.filter((view) => {
      if (filters.roomId && view.roomId !== filters.roomId) return false;
      if (filters.date && !view.occurrences.some((o) => datePart(o.start) === filters.date)) return false;
      return true;
    });
    return filtered.sort((a, b) => a.start.localeCompare(b.start));
  }

  /**
   * Cancels a booking. Admin: any time. Organizer: up to 1h before the first
   * occurrence starts. Anyone else: never. Cancelled bookings never conflict.
   */
  cancel(actor: PublicUser, bookingId: string): BookingView {
    const booking = this.bookings.findById(bookingId);
    if (!booking) throw notFoundError('Booking not found');

    const isOrganizer = booking.organizerId === actor.id;
    if (!isOrganizer && actor.role !== 'admin') {
      throw forbiddenError('Only the organizer or an admin can cancel this booking');
    }

    if (!isOrganizer || actor.role !== 'admin') {
      // Organizer path (admins bypass the window even for their own bookings).
      if (isOrganizer && actor.role !== 'admin') {
        const firstStart = parseMinute(booking.start);
        const deadline = new Date(firstStart.getTime() - CANCELLATION_WINDOW_MINUTES * 60_000);
        if (this.clock.now().getTime() > deadline.getTime()) {
          throw ruleViolationError('Bookings can only be cancelled up to 1 hour before the start');
        }
      }
    }

    const cancelled: Booking = { ...booking, status: 'cancelled' };
    this.bookings.update(cancelled);
    return this.toView(cancelled);
  }

  /** Free/busy grid for one room on one date: hourly slots 08:00–19:00 local. */
  availability(roomId: string, date: string): RoomAvailability {
    const room = this.rooms.findById(roomId);
    if (!room) throw notFoundError('Room not found');

    const occupied = this.bookings
      .findAll()
      .filter((b) => b.roomId === roomId && b.status !== 'cancelled')
      .flatMap((b) =>
        expandOccurrences(b.start, b.end, b.recurrence).map((occurrence) => ({ booking: b, occurrence })),
      );

    const slots: RoomAvailability['slots'] = [];
    for (let hour = BUSINESS_START_MINUTES / 60; hour < BUSINESS_END_MINUTES / 60; hour++) {
      const slotStart = `${date}T${String(hour).padStart(2, '0')}:00`;
      const slotEnd = `${date}T${String(hour + 1).padStart(2, '0')}:00`;
      const occupant = occupied.find(({ occurrence }) =>
        intervalsOverlap(slotStart, slotEnd, occurrence.start, occurrence.end),
      );
      slots.push({
        time: slotStart.slice(11),
        bookingId: occupant?.booking.id ?? null,
        bookingTitle: occupant?.booking.title ?? null,
      });
    }

    return { roomId: room.id, roomName: room.name, slots };
  }

  /** Finds an existing non-cancelled booking occurrence overlapping any of the requested occurrences. */
  private findConflict(roomId: string, occurrences: BookingOccurrence[]): BookingOccurrence | undefined {
    const existing = this.bookings
      .findAll()
      .filter((b) => b.roomId === roomId && b.status !== 'cancelled')
      .flatMap((b) => expandOccurrences(b.start, b.end, b.recurrence));
    for (const requested of occurrences) {
      const clash = existing.find((o) => intervalsOverlap(requested.start, requested.end, o.start, o.end));
      if (clash) return clash;
    }
    return undefined;
  }

  private toView(booking: Booking): BookingView {
    const occurrences = expandOccurrences(booking.start, booking.end, booking.recurrence);
    const organizer = this.users.findById(booking.organizerId);
    const room = this.rooms.findById(booking.roomId);
    return {
      ...booking,
      organizerName: organizer?.name ?? 'Unknown',
      roomName: room?.name ?? 'Unknown room',
      occurrences,
      status: computedStatus(booking, occurrences, this.clock.now()),
    };
  }
}
