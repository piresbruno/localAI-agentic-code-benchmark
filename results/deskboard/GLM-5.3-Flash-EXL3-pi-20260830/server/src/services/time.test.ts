// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { assertWithinBusinessHours, addDays, addMinutes, durationMinutes } from './time.js';
import { validationError } from 'deskboard-shared';

const monday = (hour: number, min = 0): string => {
  const d = new Date(2026, 8, 7); // Monday 2026-09-07
  d.setHours(hour, min, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

describe('time helpers', () => {
  it('adds days and minutes with minutes precision', () => {
    expect(addDays('2026-09-07T10:00', 7)).toBe('2026-09-14T10:00');
    expect(addMinutes('2026-09-07T10:45', 30)).toBe('2026-09-07T11:15');
    expect(durationMinutes('2026-09-07T10:00', '2026-09-07T11:30')).toBe(90);
  });

  it('accepts a booking within Mon–Fri 08:00–19:00', () => {
    expect(() => assertWithinBusinessHours(monday(8), monday(12))).not.toThrow();
    expect(() => assertWithinBusinessHours(monday(18), monday(19))).not.toThrow();
  });

  it('rejects bookings longer than 4 hours', () => {
    expect(() => assertWithinBusinessHours(monday(8), monday(12, 1))).toThrowError(/4 hours/);
  });

  it('rejects end-before-start', () => {
    expect(() => assertWithinBusinessHours(monday(10), monday(9))).toThrowError(/after start/);
  });

  it('rejects weekends', () => {
    const d = new Date(2026, 8, 5); // Saturday
    d.setHours(10, 0, 0, 0);
    const pad = (n: number) => String(n).padStart(2, '0');
    const sat = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T10:00`;
    const satEnd = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T11:00`;
    expect(() => assertWithinBusinessHours(sat, satEnd)).toThrowError(/Monday to Friday/);
  });

  it('rejects times outside 08:00–19:00 and malformed input', () => {
    expect(() => assertWithinBusinessHours(monday(7, 59), monday(8, 59))).toThrowError(/business hours/);
    expect(() => assertWithinBusinessHours(monday(18, 0), monday(19, 1))).toThrowError(/business hours/);
    try {
      assertWithinBusinessHours('not-a-date', '2026-09-07T09:00');
      expect.unreachable();
    } catch (err) {
      expect((err as ReturnType<typeof validationError>).code).toBe('VALIDATION_ERROR');
    }
  });
});
