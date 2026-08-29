import { describe, expect, it } from 'vitest';
import type { AvailabilityResponse, BookingResponse } from 'shared';
import {
  canBookAt,
  canCancelBooking,
  dateTimeToIso,
  formatDateTime,
  isBusinessDay,
  slotsNeeded,
  startTimeOptions,
  timeOnDate,
  toLocalDateString,
} from './booking';

function availability(occupiedHours: number[] = []): AvailabilityResponse {
  return {
    date: '2026-08-27',
    roomId: 'r1',
    roomName: 'Atlas',
    slots: Array.from({ length: 11 }, (_, i) => {
      const hour = 8 + i;
      const busy = occupiedHours.includes(hour);
      return {
        start: `2026-08-27T${String(hour).padStart(2, '0')}:00:00.000Z`,
        end: `2026-08-27T${String(hour + 1).padStart(2, '0')}:00:00.000Z`,
        status: busy ? 'busy' : 'free',
        bookings: busy
          ? [{ id: 'b1', title: 'Standup', status: 'confirmed' as const, organizerId: 'u1' }]
          : [],
      };
    }),
  };
}

describe('slotsNeeded', () => {
  it('uses one slot for ≤60 minutes and two for longer durations', () => {
    expect(slotsNeeded(30)).toBe(1);
    expect(slotsNeeded(60)).toBe(1);
    expect(slotsNeeded(90)).toBe(2);
    expect(slotsNeeded(120)).toBe(2);
  });
});

describe('canBookAt', () => {
  it('allows a free hour', () => {
    expect(canBookAt(availability(), 14, 30)).toBe(true);
    expect(canBookAt(availability(), 14, 60)).toBe(true);
  });

  it('blocks an occupied hour', () => {
    expect(canBookAt(availability([14]), 14, 60)).toBe(false);
  });

  it('blocks long bookings spanning an occupied neighbor', () => {
    expect(canBookAt(availability([15]), 14, 120)).toBe(false);
    expect(canBookAt(availability([15]), 14, 90)).toBe(false);
  });

  it('allows long bookings when both slots are free', () => {
    expect(canBookAt(availability(), 14, 120)).toBe(true);
  });

  it('refuses out-of-range hours', () => {
    expect(canBookAt(availability(), 7, 60)).toBe(false);
    expect(canBookAt(availability(), 19, 60)).toBe(false);
  });
});

describe('date helpers', () => {
  it('formats local dates as YYYY-MM-DD', () => {
    expect(toLocalDateString(new Date(2026, 7, 27))).toBe('2026-08-27');
  });

  it('builds ISO from date + time strings', () => {
    const iso = dateTimeToIso('2026-08-27', '14:30');
    expect(new Date(iso).getHours()).toBe(14);
    expect(new Date(iso).getMinutes()).toBe(30);
    expect(new Date(iso).getDate()).toBe(27);
  });

  it('timeOnDate uses local calendar fields', () => {
    const d = timeOnDate('2026-08-27', '09:15');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(27);
    expect(d.getHours()).toBe(9);
    expect(d.getMinutes()).toBe(15);
  });

  it('formats ISO datetimes readably', () => {
    const iso = new Date(2026, 7, 27, 9, 5).toISOString();
    expect(formatDateTime(iso)).toContain('09:05');
  });
});

describe('business calendar + options', () => {
  it('treats weekends as non-business days', () => {
    expect(isBusinessDay(new Date(2026, 7, 27))).toBe(true); // Thursday
    expect(isBusinessDay(new Date(2026, 7, 28))).toBe(true); // Friday
    expect(isBusinessDay(new Date(2026, 7, 29))).toBe(false); // Saturday
    expect(isBusinessDay(new Date(2026, 7, 30))).toBe(false); // Sunday
  });

  it('offers half-hour options from 08:00 to 18:30', () => {
    const options = startTimeOptions();
    expect(options[0]).toBe('08:00');
    expect(options[1]).toBe('08:30');
    expect(options).toContain('12:30');
    expect(options[options.length - 1]).toBe('18:30');
    expect(options).toHaveLength(22);
  });
});

describe('canCancelBooking', () => {
  const booking = (start: string) => ({ start }) as Pick<BookingResponse, 'start'>;

  it('allows cancellation more than 1h before start', () => {
    const start = new Date(Date.now() + 2 * 60 * 60_000).toISOString();
    expect(canCancelBooking(booking(start), new Date())).toBe(true);
  });

  it('blocks cancellation inside the final hour', () => {
    const start = new Date(Date.now() + 10 * 60_000).toISOString();
    expect(canCancelBooking(booking(start), new Date())).toBe(false);
  });

  it('blocks cancellation after start', () => {
    const start = new Date(Date.now() - 60_000).toISOString();
    expect(canCancelBooking(booking(start), new Date())).toBe(false);
  });
});
