import {
  BUSINESS_DAYS,
  BUSINESS_END_HOUR,
  BUSINESS_START_HOUR,
  MAX_BOOKING_MINUTES,
} from '@deskboard/shared';
import { DomainError } from './errors.js';

/**
 * Pure booking-window and overlap rules. All timestamps are local wall-clock
 * ISO strings with minutes precision (`YYYY-MM-DDTHH:mm`) — fixed width, so
 * lexicographic comparison equals chronological comparison.
 */

function minutesOfDay(iso: string): number {
  return Number(iso.slice(11, 13)) * 60 + Number(iso.slice(14, 16));
}

export function minutesBetween(start: string, end: string): number {
  return (new Date(end).getTime() - new Date(start).getTime()) / 60_000;
}

/** Spec §4: bookings only Mon–Fri 08:00–19:00 local; end > start; ≤ 4h. */
export function assertBookingWindow(start: string, end: string): void {
  if (end <= start) {
    throw new DomainError('RULE_VIOLATION', 'Booking end must be after the start');
  }
  if (minutesBetween(start, end) > MAX_BOOKING_MINUTES) {
    throw new DomainError('RULE_VIOLATION', 'Bookings are limited to 4 hours');
  }
  const startDay = new Date(start).getDay();
  if (!BUSINESS_DAYS.includes(startDay)) {
    throw new DomainError('RULE_VIOLATION', 'Bookings are only allowed Monday to Friday');
  }
  if (minutesOfDay(start) < BUSINESS_START_HOUR * 60) {
    throw new DomainError('RULE_VIOLATION', 'Business hours start at 08:00');
  }
  if (minutesOfDay(end) > BUSINESS_END_HOUR * 60) {
    throw new DomainError('RULE_VIOLATION', 'Business hours end at 19:00');
  }
}

/** Half-open interval overlap: touching (back-to-back) bookings do not conflict. */
export function overlaps(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return aStart < bEnd && bStart < aEnd;
}
