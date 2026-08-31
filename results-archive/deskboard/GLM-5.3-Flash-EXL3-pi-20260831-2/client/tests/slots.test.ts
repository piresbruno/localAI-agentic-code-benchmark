import { Booking, Room } from '@deskboard/shared';
import { describe, expect, it } from 'vitest';
import {
  addMinutes,
  buildRoomRows,
  canCancel,
  cancellationBlocker,
  DURATION_OPTIONS,
  formatBookingRange,
  SLOT_HOURS,
} from '../src/lib/slots';

describe('slot computation', () => {
  it('exposes hourly slots from 08:00 to 18:00 starts (11 columns)', () => {
    expect(SLOT_HOURS).toEqual([8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  });

  it('offers exactly the spec durations 30/60/90/120', () => {
    expect(DURATION_OPTIONS).toEqual([30, 60, 90, 120]);
  });

  it('adds minutes within the same local day', () => {
    expect(addMinutes('2026-09-01T09:00', 90)).toBe('2026-09-01T10:30');
    expect(addMinutes('2026-09-01T18:30', 30)).toBe('2026-09-01T19:00');
  });

  it('builds rows for active rooms only, filling missing grids as free', () => {
    const rooms: Room[] = [
      { id: 'r1', name: 'Hudson', capacity: 8, floor: 3, features: [], active: true },
      { id: 'r2', name: 'Old', capacity: 4, floor: 1, features: [], active: false },
    ];
    const rows = buildRoomRows(rooms, [
      {
        roomId: 'r1',
        slots: [{ start: '08:00', end: '09:00', available: false, bookingId: 'b1', title: 'X' }],
      },
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0].slots).toHaveLength(11);
    expect(rows[0].slots[0]).toMatchObject({ available: false, title: 'X' });
    expect(rows[0].slots[1].available).toBe(true);
  });
});

describe('cancellation window (UI mirror of the server rule)', () => {
  const booking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 'b1',
    roomId: 'r1',
    roomName: 'Hudson',
    title: 'T',
    organizerId: 'u1',
    start: '2026-09-01T12:00:00.000Z', // replaced below in tests via local ISO
    end: '2026-09-01T13:00:00.000Z',
    status: 'confirmed',
    attendees: 2,
    createdAt: '2026-09-01T07:00:00.000Z',
    ...overrides,
  });

  it('allows cancelling more than 1h before start', () => {
    const b = booking({ start: new Date(2026, 8, 1, 12).toISOString() });
    expect(canCancel(b, new Date(2026, 8, 1, 10, 59))).toBe(true);
    expect(cancellationBlocker(b, new Date(2026, 8, 1, 10, 59))).toBeNull();
  });

  it('allows cancelling exactly 1h before start (inclusive)', () => {
    const b = booking({ start: new Date(2026, 8, 1, 12).toISOString() });
    expect(canCancel(b, new Date(2026, 8, 1, 11, 0))).toBe(true);
  });

  it('disables cancelling inside the 1h window with a tooltip reason', () => {
    const b = booking({ start: new Date(2026, 8, 1, 12).toISOString() });
    const now = new Date(2026, 8, 1, 11, 1);
    expect(canCancel(b, now)).toBe(false);
    expect(cancellationBlocker(b, now)).toContain('1 hour');
  });

  it('always disables cancelled bookings', () => {
    const b = booking({ status: 'cancelled', start: new Date(2026, 8, 1, 23, 59).toISOString() });
    expect(canCancel(b, new Date(2026, 8, 1, 8))).toBe(false);
    expect(cancellationBlocker(b, new Date(2026, 8, 1, 8))).toBe('Already cancelled');
  });

  it('lets admins cancel anytime', () => {
    const b = booking({ start: new Date(2026, 8, 1, 9).toISOString() });
    expect(canCancel(b, new Date(2026, 8, 1, 17), true)).toBe(true);
  });
});

describe('formatBookingRange', () => {
  it('renders a stable human-readable local range', () => {
    const text = formatBookingRange(
      new Date(2026, 8, 1, 9).toISOString(),
      new Date(2026, 8, 1, 10).toISOString(),
    );
    expect(text).toMatch(/Sep 1/);
    expect(text).toContain('09:00–10:00');
  });
});
