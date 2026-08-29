/** Client-side booking/slot logic — pure functions, unit-tested (spec §6). */
import type { BookingOccurrence } from '@deskboard/shared';

/** Office business day: hourly slots 08:00–19:00. */
export const SLOT_HOURS: number[] = Array.from({ length: 11 }, (_, i) => i + 8); // 8..18

export function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Local date as YYYY-MM-DD. */
export function toDateKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

/** "YYYY-MM-DDTHH:mm" for a date key + "HH:mm" time. */
export function toMinuteString(dateKey: string, time: string): string {
  return `${dateKey}T${time}`;
}

/** Formats an occurrence for humans: "Mon 31 Aug, 09:00–10:00". */
export function formatOccurrence(occurrence: BookingOccurrence): string {
  const date = new Date(occurrence.start);
  const weekday = date.toLocaleDateString('en-GB', { weekday: 'short' });
  const day = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${weekday} ${day}, ${occurrence.start.slice(11, 16)}–${occurrence.end.slice(11, 16)}`;
}

/** First occurrence's date key (used to group bookings by day). */
export function occurrenceDateKey(occurrence: BookingOccurrence): string {
  return occurrence.start.slice(0, 10);
}

/**
 * Whether an occurrence is entirely in the past relative to `now` —
 * used to disable cancel buttons (mirrors the server's 1h window loosely
 * for UX; the server stays the authority).
 */
export function isPastOccurrence(occurrence: BookingOccurrence, now: Date = new Date()): boolean {
  const end = new Date(occurrence.end);
  return end.getTime() <= now.getTime();
}

/**
 * Whether cancellation should be offered for a booking: not cancelled,
 * not past, and more than 1h until the first occurrence starts.
 */
export function canCancel(booking: { status: string; occurrences: BookingOccurrence[] }, now: Date = new Date()): boolean {
  if (booking.status === 'cancelled') return false;
  const first = booking.occurrences[0];
  if (!first) return false;
  if (isPastOccurrence(first, now)) return false;
  const oneHourBefore = new Date(new Date(first.start).getTime() - 60 * 60 * 1000);
  return now.getTime() <= oneHourBefore.getTime();
}

/** Human reason why a booking cannot be cancelled (for tooltips/aria). */
export function cancelDisabledReason(booking: { status: string; occurrences: BookingOccurrence[] }, now: Date = new Date()): string | null {
  if (booking.status === 'cancelled') return 'This booking is already cancelled';
  const first = booking.occurrences[0];
  if (!first) return null;
  if (isPastOccurrence(first, now)) return 'This booking has already taken place';
  const oneHourBefore = new Date(new Date(first.start).getTime() - 60 * 60 * 1000);
  if (now.getTime() > oneHourBefore.getTime()) return 'Cancellation window closed (1 hour before start)';
  return null;
}

/** Options for the duration select: 30/60/90/120 minutes. */
export const DURATION_OPTIONS = [30, 60, 90, 120];

/** Computes the end minute string from a start and a duration in minutes. */
export function endFromStart(startMinute: string, durationMinutes: number): string {
  const date = new Date(startMinute);
  const end = new Date(date.getTime() + durationMinutes * 60_000);
  return `${toDateKey(end)}T${pad2(end.getHours())}:${pad2(end.getMinutes())}`;
}

/** Formats minutes as "1h 30m". */
export function formatMinutes(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}
