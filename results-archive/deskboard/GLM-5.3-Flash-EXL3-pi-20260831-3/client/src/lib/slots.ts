import type { AvailabilityResponse, Booking, BookingDto, Room } from '@deskboard/shared';
import {
  BOOKING_DURATION_OPTIONS,
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  CANCELLATION_WINDOW_MINUTES,
} from '@deskboard/shared';

/**
 * Client-side booking logic (unit-tested per spec §6): free-slot computation
 * from bookings, duration math, and cancellation-window checks for the UI.
 */

/** `YYYY-MM-DD` for a Date, in local time. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** `HH:mm` for a Date, in local time. */
export function toTimeKey(date: Date): string {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** End datetime for a start + one of the allowed durations. */
export function endFor(start: string, durationMinutes: number): string {
  if (
    !BOOKING_DURATION_OPTIONS.includes(durationMinutes as (typeof BOOKING_DURATION_OPTIONS)[number])
  ) {
    throw new Error(`unsupported duration: ${durationMinutes}`);
  }
  const endDate = new Date(start);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  return `${toDateKey(endDate)}T${toTimeKey(endDate)}`;
}

/** True when `dateKey`'s week-day is a business day (Mon–Fri). */
export function isBusinessDay(dateKey: string): boolean {
  const day = new Date(`${dateKey}T12:00`).getDay();
  return day >= 1 && day <= 5;
}

export interface GridSlot {
  start: string;
  end: string;
  /** Empty and inside business hours — clickable for a new booking. */
  bookable: boolean;
  /** Occupied by a confirmed booking. */
  booking?: BookingDto;
}

/** Hourly slots 08:00–19:00 for one room, marked busy from confirmed bookings. */
export function slotsForRoom(bookings: Booking[], roomId: string, dateKey: string): GridSlot[] {
  const active = bookings.filter(
    (b) => b.roomId === roomId && b.status === 'confirmed' && b.start.startsWith(`${dateKey}T`),
  );
  const slots: GridSlot[] = [];
  for (let hour = BUSINESS_START_HOUR; hour < BUSINESS_END_HOUR; hour++) {
    const start = `${dateKey}T${pad(hour)}:00`;
    const end = `${dateKey}T${pad(hour + 1)}:00`;
    const overlapping = active.find((b) => b.start < end && b.end > start);
    slots.push({
      start: `${pad(hour)}:00`,
      end: `${pad(hour + 1)}:00`,
      bookable: !overlapping && isBusinessDay(dateKey),
      booking: overlapping as BookingDto | undefined,
    });
  }
  return slots;
}

/** True when the cancellation window is open for this booking right now. */
export function canCancel(booking: Pick<Booking, 'start'>, now: Date): boolean {
  const minutesLeft = (new Date(booking.start).getTime() - now.getTime()) / 60_000;
  return minutesLeft >= CANCELLATION_WINDOW_MINUTES;
}

/** Tooltip text explaining why the cancel button is disabled. */
export function cancelDisabledReason(): string {
  return `Cancellations are only possible up to ${CANCELLATION_WINDOW_MINUTES} minutes before the start`;
}

/** Splits own bookings into upcoming (not ended) and past. */
export function splitUpcoming(
  bookings: BookingDto[],
  now: Date,
): {
  upcoming: BookingDto[];
  past: BookingDto[];
} {
  const nowKey = `${toDateKey(now)}T${toTimeKey(now)}`;
  const upcoming = bookings.filter((b) => b.status === 'confirmed' && b.end >= nowKey);
  const past = bookings.filter((b) => b.status === 'cancelled' || b.end < nowKey);
  return { upcoming, past };
}

/** Derives the human slot label from an availability grid (kept for API parity). */
export function busySlotStarts(grid: AvailabilityResponse): string[] {
  return grid.slots.filter((s) => !s.available).map((s) => s.start);
}

export interface RoomWithSlots {
  room: Room;
  slots: GridSlot[];
}

/** Full grid: rooms × hourly slots for the chosen date. */
export function buildGrid(rooms: Room[], bookings: Booking[], dateKey: string): RoomWithSlots[] {
  return rooms.map((room) => ({ room, slots: slotsForRoom(bookings, room.id, dateKey) }));
}
