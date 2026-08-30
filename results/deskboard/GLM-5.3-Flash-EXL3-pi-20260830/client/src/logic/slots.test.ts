// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import {
  canCancelBooking,
  cancellationTooltip,
  gridSlotStarts,
  splitUpcomingPast,
  timeLabel,
  todayIso
} from './slots.js';

const NOW = new Date('2026-09-07T09:00:00');
const employee = { id: 'u-1', role: 'employee' as const };
const admin = { id: 'u-admin', role: 'admin' as const };

describe('gridSlotStarts', () => {
  it('produces hourly slots 08:00 through 18:00 (11 slots, 19:00 close)', () => {
    const slots = gridSlotStarts();
    expect(slots).toHaveLength(11);
    expect(slots[0]).toBe('08:00');
    expect(slots[slots.length - 1]).toBe('18:00');
  });
});

describe('timeLabel / todayIso', () => {
  it('strips the date part from ISO datetimes', () => {
    expect(timeLabel('2026-09-07T10:30')).toBe('10:30');
  });

  it('formats today as YYYY-MM-DD', () => {
    expect(todayIso(new Date('2026-09-07T23:59:00'))).toBe('2026-09-07');
  });
});

describe('canCancelBooking', () => {
  it('allows the organizer to cancel more than 1h before start', () => {
    const booking = { status: 'confirmed', start: '2026-09-07T11:00', organizer: { id: 'u-1' } };
    expect(canCancelBooking(booking, employee, NOW)).toBe(true);
  });

  it('blocks the organizer within the 1h window', () => {
    const booking = { status: 'confirmed', start: '2026-09-07T09:30', organizer: { id: 'u-1' } };
    expect(canCancelBooking(booking, employee, NOW)).toBe(false);
  });

  it('allows admins anytime, even inside the window', () => {
    const booking = { status: 'confirmed', start: '2026-09-07T09:05', organizer: { id: 'u-1' } };
    expect(canCancelBooking(booking, admin, NOW)).toBe(true);
  });

  it('never allows non-organizers, cancelled or completed bookings', () => {
    const other = { status: 'confirmed', start: '2026-09-07T11:00', organizer: { id: 'u-2' } };
    expect(canCancelBooking(other, employee, NOW)).toBe(false);
    expect(
      canCancelBooking(
        { status: 'cancelled', start: '2026-09-07T11:00', organizer: { id: 'u-1' } },
        employee,
        NOW
      )
    ).toBe(false);
    expect(
      canCancelBooking(
        { status: 'completed', start: '2026-09-07T11:00', organizer: { id: 'u-1' } },
        employee,
        NOW
      )
    ).toBe(false);
  });
});

describe('cancellationTooltip', () => {
  it('explains why cancelling is blocked', () => {
    const soon = { status: 'confirmed', start: '2026-09-07T09:30', organizer: { id: 'u-1' } };
    expect(cancellationTooltip(soon, employee, NOW)).toMatch(/1 hour/);

    const others = { status: 'confirmed', start: '2026-09-07T11:00', organizer: { id: 'u-2' } };
    expect(cancellationTooltip(others, employee, NOW)).toMatch(/organizer or an admin/);

    const cancelled = { status: 'cancelled', start: '2026-09-07T11:00', organizer: { id: 'u-1' } };
    expect(cancellationTooltip(cancelled, employee, NOW)).toMatch(/Already cancelled/);
  });
});

describe('splitUpcomingPast', () => {
  it('splits by end time and separates cancelled bookings', () => {
    const bookings = [
      { id: 'a', end: '2026-09-07T08:00', status: 'confirmed' },
      { id: 'b', end: '2026-09-07T12:00', status: 'confirmed' },
      { id: 'c', end: '2026-09-07T15:00', status: 'cancelled' }
    ];
    const { upcoming, past } = splitUpcomingPast(bookings, NOW);
    expect(upcoming.map((b) => b.id)).toEqual(['b']);
    expect(past.map((b) => b.id)).toEqual(['a', 'c']);
  });
});
