/** Unit tests for client-side slot/booking logic (spec §6: UI logic unit-tested). */
import { describe, expect, it } from 'vitest';
import {
  canCancel,
  cancelDisabledReason,
  endFromStart,
  formatMinutes,
  formatOccurrence,
  isPastOccurrence,
  toDateKey,
  todayKey,
  toMinuteString,
} from './slots.js';

describe('toDateKey / todayKey / toMinuteString', () => {
  it('formats a local date as YYYY-MM-DD', () => {
    expect(toDateKey(new Date(2026, 7, 31))).toBe('2026-08-31');
  });

  it('builds minute strings from date + time', () => {
    expect(toMinuteString('2026-08-31', '09:30')).toBe('2026-08-31T09:30');
  });

  it('todayKey returns a valid date key', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('endFromStart', () => {
  it('adds the duration to the start', () => {
    expect(endFromStart('2026-08-31T09:00', 90)).toBe('2026-08-31T10:30');
  });

  it('rolls over midnight when the duration crosses days', () => {
    expect(endFromStart('2026-08-31T23:30', 120)).toBe('2026-09-01T01:30');
  });
});

describe('formatMinutes / formatOccurrence', () => {
  it('formats minutes as hours and minutes', () => {
    expect(formatMinutes(60)).toBe('1h');
    expect(formatMinutes(90)).toBe('1h 30m');
    expect(formatMinutes(45)).toBe('45m');
  });

  it('formats an occurrence readably', () => {
    const text = formatOccurrence({ start: '2026-08-31T09:00', end: '2026-08-31T10:00' });
    expect(text).toMatch(/Mon 31 Aug, 09:00–10:00/);
  });
});

describe('canCancel / cancelDisabledReason', () => {
  const future = { status: 'confirmed', occurrences: [{ start: '2026-08-31T12:00', end: '2026-08-31T13:00' }] };

  it('allows cancelling more than 1h before the start', () => {
    const now = new Date('2026-08-31T10:00');
    expect(canCancel(future, now)).toBe(true);
    expect(cancelDisabledReason(future, now)).toBeNull();
  });

  it('forbids cancelling within the 1h window', () => {
    const now = new Date('2026-08-31T11:30');
    expect(canCancel(future, now)).toBe(false);
    expect(cancelDisabledReason(future, now)).toMatch(/window closed/);
  });

  it('forbids cancelling cancelled or past bookings', () => {
    const now = new Date('2026-08-31T10:00');
    expect(canCancel({ ...future, status: 'cancelled' }, now)).toBe(false);
    const past = { status: 'confirmed', occurrences: [{ start: '2026-08-31T08:00', end: '2026-08-31T09:00' }] };
    expect(canCancel(past, now)).toBe(false);
    expect(isPastOccurrence(past.occurrences[0], now)).toBe(true);
  });
});
