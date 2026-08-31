import { describe, expect, it } from 'vitest';
import {
  buildGrid,
  canCancel,
  endFor,
  isBusinessDay,
  slotsForRoom,
  splitUpcoming,
} from '../src/lib/slots.js';
import type { Booking, Room } from '@deskboard/shared';

const room: Room = {
  id: 'r1',
  name: 'Board Room',
  capacity: 10,
  floor: 3,
  features: [],
  active: true,
};

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  roomId: 'r1',
  title: 'Standup',
  organizerId: 'u1',
  start: '2026-09-01T09:00',
  end: '2026-09-01T10:00',
  status: 'confirmed',
  attendees: 3,
  createdAt: '2026-08-31T10:00',
  ...over,
});

describe('endFor', () => {
  it('adds each supported duration to the start', () => {
    expect(endFor('2026-09-01T09:00', 30)).toBe('2026-09-01T09:30');
    expect(endFor('2026-09-01T09:00', 60)).toBe('2026-09-01T10:00');
    expect(endFor('2026-09-01T09:00', 90)).toBe('2026-09-01T10:30');
    expect(endFor('2026-09-01T09:00', 120)).toBe('2026-09-01T11:00');
  });

  it('rolls over midnight correctly for a late start', () => {
    expect(endFor('2026-09-01T23:45', 30)).toBe('2026-09-02T00:15');
  });

  it('rejects unsupported durations', () => {
    expect(() => endFor('2026-09-01T09:00', 45)).toThrow(/unsupported duration/);
  });
});

describe('isBusinessDay', () => {
  it('accepts weekdays and rejects weekends', () => {
    expect(isBusinessDay('2026-09-01')).toBe(true); // Tuesday
    expect(isBusinessDay('2026-09-04')).toBe(true); // Friday
    expect(isBusinessDay('2026-09-05')).toBe(false); // Saturday
    expect(isBusinessDay('2026-09-06')).toBe(false); // Sunday
  });
});

describe('slotsForRoom', () => {
  it('returns 11 hourly slots from 08:00 to 19:00', () => {
    const slots = slotsForRoom([], 'r1', '2026-09-01');
    expect(slots).toHaveLength(11);
    expect(slots[0]).toMatchObject({ start: '08:00', end: '09:00', bookable: true });
    expect(slots[10]).toMatchObject({ start: '18:00', end: '19:00', bookable: true });
  });

  it('marks slots overlapping a confirmed booking as busy and not bookable', () => {
    const slots = slotsForRoom([booking()], 'r1', '2026-09-01');
    expect(slots[1]).toMatchObject({ start: '09:00', bookable: false });
    expect(slots[1].booking?.title).toBe('Standup');
    expect(slots[2]).toMatchObject({ start: '10:00', bookable: true }); // adjacent is free
  });

  it('ignores cancelled bookings', () => {
    const slots = slotsForRoom([booking({ status: 'cancelled' })], 'r1', '2026-09-01');
    expect(slots[1]?.bookable).toBe(true);
  });

  it('ignores bookings of other rooms and other dates', () => {
    const slots = slotsForRoom(
      [booking({ roomId: 'r2' }), booking({ start: '2026-09-02T09:00', end: '2026-09-02T10:00' })],
      'r1',
      '2026-09-01',
    );
    expect(slots.every((s) => s.bookable)).toBe(true);
  });

  it('marks every slot unbookable on weekends', () => {
    const slots = slotsForRoom([], 'r1', '2026-09-05');
    expect(slots.every((s) => !s.bookable)).toBe(true);
  });
});

describe('canCancel', () => {
  const start = '2026-09-01T12:00';

  it('is true at exactly one hour before the start', () => {
    expect(canCancel({ start }, new Date(2026, 8, 1, 11, 0))).toBe(true);
  });

  it('is true well before the start', () => {
    expect(canCancel({ start }, new Date(2026, 8, 1, 9, 0))).toBe(true);
  });

  it('is false inside the one-hour window', () => {
    expect(canCancel({ start }, new Date(2026, 8, 1, 11, 1))).toBe(false);
  });

  it('is false once the booking has started', () => {
    expect(canCancel({ start }, new Date(2026, 8, 1, 12, 30))).toBe(false);
  });
});

describe('splitUpcoming', () => {
  const now = new Date(2026, 8, 1, 12, 0);

  it('splits confirmed future bookings from past and cancelled ones', () => {
    const bookings = [
      booking({ id: 'future', start: '2026-09-01T14:00', end: '2026-09-01T15:00' }),
      booking({ id: 'past', start: '2026-09-01T09:00', end: '2026-09-01T10:00' }),
      booking({
        id: 'cancelled',
        status: 'cancelled',
        start: '2026-09-01T14:00',
        end: '2026-09-01T15:00',
      }),
    ];
    const { upcoming, past } = splitUpcoming(bookings, now);
    expect(upcoming.map((b) => b.id)).toEqual(['future']);
    expect(past.map((b) => b.id).sort()).toEqual(['cancelled', 'past']);
  });
});

describe('buildGrid', () => {
  it('builds rooms × slots with room metadata', () => {
    const grid = buildGrid(
      [room, { ...room, id: 'r2', name: 'Focus Pod' }],
      [booking()],
      '2026-09-01',
    );
    expect(grid).toHaveLength(2);
    expect(grid[0]?.room.name).toBe('Board Room');
    expect(grid[0]?.slots).toHaveLength(11);
    expect(grid[1]?.slots[1]?.bookable).toBe(true); // other room unaffected
  });
});
