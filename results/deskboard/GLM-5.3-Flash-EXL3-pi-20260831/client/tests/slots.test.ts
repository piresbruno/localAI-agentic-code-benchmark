import { describe, expect, it } from 'vitest';
import type { AvailabilityDto, BookingDto, RoomDto } from '@deskboard/shared';
import { buildGrid, canCancel, hhmm, partitionBookings, timeRange } from '../src/lib/slots';
import { WED } from './fixtures';

const room: RoomDto = { id: 'r1', name: 'Fjord', capacity: 8, floor: 3, features: ['screen'], active: true };

function booking(overrides: Partial<BookingDto> = {}): BookingDto {
  return {
    id: 'b1',
    roomId: 'r1',
    roomName: 'Fjord',
    title: 'Sync',
    organizerId: 'u1',
    organizerName: 'Emma',
    start: `${WED}T11:00`,
    end: `${WED}T12:00`,
    status: 'confirmed',
    attendees: 2,
    createdAt: `${WED}T09:00`,
    ...overrides,
  };
}

describe('buildGrid', () => {
  it('produces 11 hourly cells per room, free by default', () => {
    const grid = buildGrid([room], []);
    expect(grid).toHaveLength(1);
    expect(grid[0].cells).toHaveLength(11);
    expect(grid[0].cells.every((c) => c.kind === 'free')).toBe(true);
  });

  it('marks busy cells with the booking from availability data', () => {
    const availability: AvailabilityDto = {
      roomId: 'r1',
      date: WED,
      slots: Array.from({ length: 11 }, (_, i) => ({
        start: hhmm(8 + i),
        end: hhmm(9 + i),
        booking: i === 3 ? { id: 'b1', title: 'Design review' } : null,
      })),
    };
    const grid = buildGrid([room], [availability]);
    expect(grid[0].cells[3]).toEqual({ kind: 'busy', booking: { id: 'b1', title: 'Design review' } });
    expect(grid[0].cells[4].kind).toBe('free');
  });
});

describe('canCancel — mirrors enforces_cancellation_window', () => {
  const now = new Date(`${WED}T10:00`);

  it('allows cancelling 2 hours before start', () => {
    expect(canCancel(booking({ start: `${WED}T12:00` }), now)).toBe(true);
  });

  it('allows cancelling exactly 1 hour before start', () => {
    expect(canCancel(booking({ start: `${WED}T11:00` }), now)).toBe(true);
  });

  it('forbids cancelling 59 minutes before start', () => {
    expect(canCancel(booking({ start: `${WED}T10:59` }), now)).toBe(false);
  });

  it('forbids cancelling after the start passed', () => {
    expect(canCancel(booking({ start: `${WED}T09:00` }), now)).toBe(false);
  });

  it('forbids cancelling non-confirmed bookings', () => {
    expect(canCancel(booking({ status: 'cancelled' }), now)).toBe(false);
  });
});

describe('partitionBookings', () => {
  const now = new Date(`${WED}T10:00`);

  it('splits upcoming (future confirmed) from past/cancelled', () => {
    const all = [
      booking({ id: 'past', start: `${WED}T08:00`, end: `${WED}T09:00` }),
      booking({ id: 'future', start: `${WED}T14:00`, end: `${WED}T15:00` }),
      booking({ id: 'cancelled', start: `${WED}T16:00`, end: `${WED}T17:00`, status: 'cancelled' }),
    ];
    const { upcoming, past } = partitionBookings(all, now);
    expect(upcoming.map((b) => b.id)).toEqual(['future']);
    expect(past.map((b) => b.id)).toEqual(['past', 'cancelled']);
  });
});

describe('timeRange', () => {
  it('formats the HH:mm – HH:mm range', () => {
    expect(timeRange(booking())).toBe('11:00 – 12:00');
  });
});
