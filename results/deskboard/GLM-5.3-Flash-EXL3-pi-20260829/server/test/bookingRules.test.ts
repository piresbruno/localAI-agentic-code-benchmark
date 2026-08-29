/** Unit tests for the pure booking rule helpers (spec §4 business rules). */
import { describe, expect, it } from 'vitest';
import {
  assertOccurrenceWithinBusinessHours,
  computedStatus,
  expandOccurrences,
  formatMinute,
  intervalsOverlap,
  parseMinute,
} from '../src/services/bookingService.js';
import { DomainError } from '@deskboard/shared';

describe('parseMinute', () => {
  it('parses a local minute string', () => {
    const parsed = parseMinute('2026-08-31T09:30');
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(7);
    expect(parsed.getDate()).toBe(31);
    expect(parsed.getHours()).toBe(9);
    expect(parsed.getMinutes()).toBe(30);
  });

  it('rejects malformed datetime strings', () => {
    expect(() => parseMinute('2026-08-31')).toThrow(DomainError);
    expect(() => parseMinute('2026-13-01T09:00')).toThrow(DomainError);
    expect(() => parseMinute('2026-02-30T09:00')).toThrow(DomainError); // Feb 30 doesn't exist
  });

  it('round-trips through formatMinute', () => {
    expect(formatMinute(parseMinute('2026-08-31T09:30'))).toBe('2026-08-31T09:30');
  });
});

describe('expandOccurrences', () => {
  it('returns a single occurrence when recurrence is none', () => {
    const occurrences = expandOccurrences('2026-08-31T09:00', '2026-08-31T10:00', { kind: 'none' });
    expect(occurrences).toEqual([{ start: '2026-08-31T09:00', end: '2026-08-31T10:00' }]);
  });

  it('creates weekly occurrences 7 days apart', () => {
    const occurrences = expandOccurrences('2026-08-31T09:00', '2026-08-31T10:00', { kind: 'weekly', count: 3 });
    expect(occurrences.map((o) => o.start)).toEqual([
      '2026-08-31T09:00',
      '2026-09-07T09:00',
      '2026-09-14T09:00',
    ]);
    expect(occurrences.every((o) => o.end.endsWith('10:00'))).toBe(true);
  });

  it('keeps weekly times across DST-adjacent month boundaries', () => {
    const occurrences = expandOccurrences('2026-10-26T09:00', '2026-10-26T10:00', { kind: 'weekly', count: 2 });
    expect(occurrences[1].start).toBe('2026-11-02T09:00');
  });
});

describe('intervalsOverlap', () => {
  it('detects overlap', () => {
    expect(intervalsOverlap('09:00', '10:00', '09:30', '11:00')).toBe(true);
    expect(intervalsOverlap('09:00', '10:00', '08:00', '09:01')).toBe(true);
  });

  it('allows back-to-back adjacent bookings', () => {
    expect(intervalsOverlap('09:00', '10:00', '10:00', '11:00')).toBe(false);
    expect(intervalsOverlap('09:00', '10:00', '08:00', '09:00')).toBe(false);
  });
});

describe('assertOccurrenceWithinBusinessHours', () => {
  it('accepts a normal weekday slot', () => {
    expect(() => assertOccurrenceWithinBusinessHours({ start: '2026-08-31T08:00', end: '2026-08-31T12:00' })).not.toThrow();
  });

  it('rejects booking outside business hours — weekend', () => {
    // 2026-08-29 is a Saturday
    expect(() => assertOccurrenceWithinBusinessHours({ start: '2026-08-29T09:00', end: '2026-08-29T10:00' })).toThrow(
      /Monday to Friday/,
    );
  });

  it('rejects booking outside business hours — before 08:00', () => {
    expect(() => assertOccurrenceWithinBusinessHours({ start: '2026-08-31T07:30', end: '2026-08-31T08:30' })).toThrow(
      /08:00/,
    );
  });

  it('rejects booking outside business hours — after 19:00', () => {
    expect(() => assertOccurrenceWithinBusinessHours({ start: '2026-08-31T18:00', end: '2026-08-31T19:30' })).toThrow(
      /19:00/,
    );
  });

  it('rejects booking when end equals start', () => {
    expect(() => assertOccurrenceWithinBusinessHours({ start: '2026-08-31T09:00', end: '2026-08-31T09:00' })).toThrow(
      /after the start/,
    );
  });

  it('rejects booking longer than 4 hours', () => {
    expect(() => assertOccurrenceWithinBusinessHours({ start: '2026-08-31T09:00', end: '2026-08-31T13:01' })).toThrow(
      /4 hours/,
    );
  });

  it('accepts exactly 4 hours at the business-day edges', () => {
    expect(() => assertOccurrenceWithinBusinessHours({ start: '2026-08-31T08:00', end: '2026-08-31T12:00' })).not.toThrow();
    expect(() => assertOccurrenceWithinBusinessHours({ start: '2026-08-31T15:00', end: '2026-08-31T19:00' })).not.toThrow();
  });
});

describe('computedStatus', () => {
  const base = {
    id: 'b1',
    roomId: 'r1',
    title: 'Standup',
    organizerId: 'u1',
    recurrence: { kind: 'none' } as const,
    attendees: 3,
    createdAt: '2026-08-31T07:00:00.000Z',
  };

  it('marks bookings whose end passed as completed without mutating stored status', () => {
    const booking = { ...base, start: '2026-08-31T09:00', end: '2026-08-31T10:00', status: 'confirmed' as const };
    const now = parseMinute('2026-08-31T11:00');
    expect(computedStatus(booking, booking.end ? [{ start: booking.start, end: booking.end }] : [], now)).toBe('completed');
    expect(booking.status).toBe('confirmed'); // history never mutated
  });

  it('keeps future bookings confirmed', () => {
    const booking = { ...base, start: '2026-08-31T09:00', end: '2026-08-31T10:00', status: 'confirmed' as const };
    const now = parseMinute('2026-08-31T08:00');
    expect(computedStatus(booking, [{ start: booking.start, end: booking.end }], now)).toBe('confirmed');
  });

  it('keeps cancelled bookings cancelled even in the future', () => {
    const booking = { ...base, start: '2026-08-31T09:00', end: '2026-08-31T10:00', status: 'cancelled' as const };
    expect(computedStatus(booking, [{ start: booking.start, end: booking.end }], parseMinute('2026-08-31T08:00'))).toBe('cancelled');
  });

  it('uses the last occurrence for recurring bookings', () => {
    const booking = { ...base, start: '2026-08-31T09:00', end: '2026-08-31T10:00', status: 'confirmed' as const };
    const occurrences = expandOccurrences(booking.start, booking.end, { kind: 'weekly', count: 3 });
    const midWay = parseMinute('2026-09-08T09:00');
    expect(computedStatus(booking, occurrences, midWay)).toBe('confirmed');
    const afterAll = parseMinute('2026-09-15T09:00');
    expect(computedStatus(booking, occurrences, afterAll)).toBe('completed');
  });
});
