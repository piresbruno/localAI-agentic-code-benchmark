/**
 * Pure datetime helpers for booking rules. All datetimes are local ISO-8601
 * strings with minutes precision (`YYYY-MM-DDTHH:mm`), which compare
 * correctly with plain string ordering.
 */
import { validationError } from 'deskboard-shared';

export const BUSINESS_OPEN_MINUTES = 8 * 60; // 08:00
export const BUSINESS_CLOSE_MINUTES = 19 * 60; // 19:00
export const MAX_DURATION_MINUTES = 4 * 60;

const toMinutes = (hhmm: string): number => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

export const timeOfDay = (iso: string): string => iso.slice(11);
export const dayOf = (iso: string): string => iso.slice(0, 10);

/** Adds days (keeping minutes precision) to a local ISO datetime. */
export const addDays = (iso: string, days: number): string => {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return formatLocal(d);
};

export const addMinutes = (iso: string, minutes: number): string => {
  const d = new Date(iso);
  d.setMinutes(d.getMinutes() + minutes);
  return formatLocal(d);
};

const formatLocal = (d: Date): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
};

export const durationMinutes = (start: string, end: string): number =>
  (new Date(end).getTime() - new Date(start).getTime()) / 60_000;

/**
 * Business hours rule: Mon–Fri 08:00–19:00 local, end after start,
 * duration at most 4 hours.
 */
export const assertWithinBusinessHours = (start: string, end: string): void => {
  const startDate = new Date(start);
  if (Number.isNaN(startDate.getTime())) {
    throw validationError('start is not a valid datetime', { field: 'start' });
  }
  if (end <= start) {
    throw validationError('end must be after start', { field: 'start' });
  }
  const duration = durationMinutes(start, end);
  if (duration > MAX_DURATION_MINUTES) {
    throw validationError('Bookings may last at most 4 hours', { field: 'durationMinutes' });
  }
  const day = startDate.getDay(); // 0 = Sunday, 6 = Saturday
  if (day === 0 || day === 6) {
    throw validationError('Bookings are only allowed Monday to Friday', { field: 'start' });
  }
  const startMin = toMinutes(timeOfDay(start));
  const endMin = toMinutes(timeOfDay(end));
  if (startMin < BUSINESS_OPEN_MINUTES || endMin > BUSINESS_CLOSE_MINUTES) {
    throw validationError('Bookings must be within business hours (08:00–19:00)', {
      field: 'start'
    });
  }
};
