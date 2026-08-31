import { describe, expect, it } from 'vitest';
import { AppError } from '../src/services/errors';
import { WED, makeCtx } from './helpers';

function errorCode(fn: () => unknown): string {
  try {
    fn();
    throw new Error('expected an AppError to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return (err as AppError).code;
  }
}

describe('AvailabilityService.forRoom', () => {
  it('returns 11 hourly slots 08:00–19:00, all free by default', () => {
    const ctx = makeCtx();
    const avail = ctx.availSvc.forRoom(ctx.roomId, WED);
    expect(avail.slots).toHaveLength(11);
    expect(avail.slots[0]).toMatchObject({ start: '08:00', end: '09:00', booking: null });
    expect(avail.slots[10]).toMatchObject({ start: '18:00', end: '19:00', booking: null });
  });

  it('marks slots busy when a confirmed booking overlaps them', () => {
    const ctx = makeCtx();
    const booking = ctx.bookingSvc.create(ctx.employee, {
      roomId: ctx.roomId,
      title: 'Design review',
      start: `${WED}T10:30`,
      end: `${WED}T12:00`,
      attendees: 3,
    });
    const avail = ctx.availSvc.forRoom(ctx.roomId, WED);
    expect(avail.slots[2]).toEqual({
      start: '10:00',
      end: '11:00',
      booking: { id: booking.id, title: 'Design review' },
    });
    expect(avail.slots[3]).toEqual({
      start: '11:00',
      end: '12:00',
      booking: { id: booking.id, title: 'Design review' },
    });
    expect(avail.slots[4].booking).toBeNull(); // 12:00–13:00 free again
  });

  it('404s for unknown rooms', () => {
    const ctx = makeCtx();
    expect(errorCode(() => ctx.availSvc.forRoom('nope', WED))).toBe('NOT_FOUND');
  });
});
