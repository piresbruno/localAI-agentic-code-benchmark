/**
 * Pure time helpers for the domain layer. "Local" always means the server's
 * own timezone (documented in README); tests build Dates with local fields so
 * they are timezone-independent.
 */
import type { CalendarDate } from 'shared';
import { BUSINESS_HOURS } from 'shared';

export function parseIso(iso: string): Date {
  return new Date(iso);
}

export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

export function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/** Local midnight of a `YYYY-MM-DD` calendar date. */
export function startOfLocalDay(calendarDate: CalendarDate): Date {
  const [y, m, d] = calendarDate.split('-').map(Number);
  return new Date(y!, m! - 1, d!, 0, 0, 0, 0);
}

/** Exclusive end of a local day (midnight of the next day). */
export function endOfLocalDay(calendarDate: CalendarDate): Date {
  return addDays(startOfLocalDay(calendarDate), 1);
}

export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** 08:00 ≤ time; used for the start of a booking. */
export function isAtOrAfterBusinessStart(date: Date): boolean {
  return date.getHours() * 60 + date.getMinutes() >= BUSINESS_HOURS.start * 60;
}

/** time ≤ 19:00; used for the end of a booking (19:00 is an allowed end). */
export function isWithinBusinessEnd(date: Date): boolean {
  return date.getHours() * 60 + date.getMinutes() <= BUSINESS_HOURS.end * 60;
}

/** Whole [start, end) must sit inside Mon–Fri 08:00–19:00. */
export function isWithinBusinessWindow(start: Date, end: Date): boolean {
  return !isWeekend(start) && isAtOrAfterBusinessStart(start) && isWithinBusinessEnd(end);
}

export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/** Compare two intervals for an overlap summary (used by conflict errors). */
export interface Interval {
  start: Date;
  end: Date;
}

export function intervalOverlap(a: Interval, b: Interval): boolean {
  return overlaps(a.start, a.end, b.start, b.end);
}
