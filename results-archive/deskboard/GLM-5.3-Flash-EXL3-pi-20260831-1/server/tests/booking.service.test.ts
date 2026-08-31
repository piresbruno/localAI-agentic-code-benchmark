import { describe, expect, it } from 'vitest';
import type { BookingCreateInput } from '@deskboard/shared';
import { AppError } from '../src/services/errors';
import { SAT, WED, makeCtx, type Ctx } from './helpers';

function bookingInput(ctx: Ctx, overrides: Partial<BookingCreateInput> = {}): BookingCreateInput {
  return {
    roomId: ctx.roomId,
    title: 'Sprint sync',
    start: `${WED}T11:00`,
    end: `${WED}T12:00`,
    attendees: 3,
    ...overrides,
  };
}

function errorCode(fn: () => unknown): string {
  try {
    fn();
    throw new Error('expected an AppError to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return (err as AppError).code;
  }
}

describe('BookingService.create', () => {
  it('creates a booking with injected id and createdAt', () => {
    const ctx = makeCtx();
    const dto = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    expect(dto.id).toBe('id-1'); // fixture repos are seeded with literal ids
    expect(dto.status).toBe('confirmed');
    expect(dto.roomName).toBe('Fjord');
    expect(dto.organizerName).toBe('Emma Employee');
  });

  it('rejects_booking_outside_business_hours (weekend)', () => {
    const ctx = makeCtx();
    expect(
      errorCode(() =>
        ctx.bookingSvc.create(
          ctx.employee,
          bookingInput(ctx, { start: `${SAT}T11:00`, end: `${SAT}T12:00` }),
        ),
      ),
    ).toBe('OUTSIDE_BUSINESS_HOURS');
  });

  it('rejects_booking_outside_business_hours (before 08:00 and after 19:00)', () => {
    const ctx = makeCtx();
    expect(
      errorCode(() =>
        ctx.bookingSvc.create(
          ctx.employee,
          bookingInput(ctx, { start: `${WED}T07:00`, end: `${WED}T08:00` }),
        ),
      ),
    ).toBe('OUTSIDE_BUSINESS_HOURS');
    expect(
      errorCode(() =>
        ctx.bookingSvc.create(
          ctx.employee,
          bookingInput(ctx, { start: `${WED}T18:00`, end: `${WED}T19:30` }),
        ),
      ),
    ).toBe('OUTSIDE_BUSINESS_HOURS');
  });

  it('allows boundary hours (08:00 / 19:00); past ones read back as completed', () => {
    const ctx = makeCtx();
    const early = ctx.bookingSvc.create(
      ctx.employee,
      bookingInput(ctx, { title: 'early', start: `${WED}T08:00`, end: `${WED}T09:00` }),
    );
    const late = ctx.bookingSvc.create(
      ctx.employee,
      bookingInput(ctx, { title: 'late', start: `${WED}T18:00`, end: `${WED}T19:00` }),
    );
    expect(early.status).toBe('completed'); // 08:00–09:00 is before “now” (10:00)
    expect(late.status).toBe('confirmed');
  });

  it('rejects a booking that ends before it starts', () => {
    const ctx = makeCtx();
    expect(
      errorCode(() =>
        ctx.bookingSvc.create(
          ctx.employee,
          bookingInput(ctx, { start: `${WED}T12:00`, end: `${WED}T11:00` }),
        ),
      ),
    ).toBe('INVALID_TIME_RANGE');
  });

  it('rejects bookings longer than four hours', () => {
    const ctx = makeCtx();
    expect(
      errorCode(() =>
        ctx.bookingSvc.create(
          ctx.employee,
          bookingInput(ctx, { start: `${WED}T10:00`, end: `${WED}T14:30` }),
        ),
      ),
    ).toBe('DURATION_EXCEEDS_LIMIT');
  });

  it('rejects_booking_when_room_already_booked (409 ROOM_CONFLICT)', () => {
    const ctx = makeCtx();
    ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    expect(
      errorCode(() =>
        ctx.bookingSvc.create(
          ctx.otherEmployee,
          bookingInput(ctx, { start: `${WED}T11:30`, end: `${WED}T12:30` }),
        ),
      ),
    ).toBe('ROOM_CONFLICT');
  });

  it('allows adjacent bookings back-to-back', () => {
    const ctx = makeCtx();
    ctx.bookingSvc.create(ctx.employee, bookingInput(ctx, { start: `${WED}T11:00`, end: `${WED}T12:00` }));
    const adjacent = ctx.bookingSvc.create(
      ctx.otherEmployee,
      bookingInput(ctx, { start: `${WED}T12:00`, end: `${WED}T13:00` }),
    );
    expect(adjacent.status).toBe('confirmed');
  });

  it('ignores cancelled bookings when checking conflicts', () => {
    const ctx = makeCtx();
    const first = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    ctx.bookingSvc.cancel(ctx.employee, first.id);
    const rebooked = ctx.bookingSvc.create(
      ctx.otherEmployee,
      bookingInput(ctx, { start: `${WED}T11:30`, end: `${WED}T12:30` }),
    );
    expect(rebooked.status).toBe('confirmed');
  });

  it('rejects_booking_over_capacity (422)', () => {
    const ctx = makeCtx();
    expect(
      errorCode(() => ctx.bookingSvc.create(ctx.employee, bookingInput(ctx, { attendees: 9 }))),
    ).toBe('OVER_CAPACITY');
  });

  it('rejects_bookings_for_inactive_rooms (409) but keeps cancellations working', () => {
    const ctx = makeCtx();
    const existing = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    ctx.roomSvc.deactivate(ctx.admin, ctx.roomId);
    expect(errorCode(() => ctx.bookingSvc.create(ctx.employee, bookingInput(ctx)))).toBe(
      'ROOM_INACTIVE',
    );
    const cancelled = ctx.bookingSvc.cancel(ctx.employee, existing.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('rejects bookings for unknown rooms (404)', () => {
    const ctx = makeCtx();
    expect(
      errorCode(() => ctx.bookingSvc.create(ctx.employee, bookingInput(ctx, { roomId: 'nope' }))),
    ).toBe('NOT_FOUND');
  });
});

describe('BookingService.cancel — enforces_cancellation_window', () => {
  it('lets the organizer cancel up to 1h before start', () => {
    const ctx = makeCtx(); // now 10:00, booking starts 11:00 → deadline exactly now
    const booking = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    const cancelled = ctx.bookingSvc.cancel(ctx.employee, booking.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('rejects the organizer cancelling inside the 1h window (422)', () => {
    const ctx = makeCtx(new Date('2026-09-02T10:00:01')); // one second past the deadline
    const booking = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    expect(errorCode(() => ctx.bookingSvc.cancel(ctx.employee, booking.id))).toBe(
      'CANCELLATION_WINDOW_PASSED',
    );
  });

  it('lets an admin cancel anytime, even inside the window', () => {
    const ctx = makeCtx(new Date('2026-09-02T10:59:00'));
    const booking = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    const cancelled = ctx.bookingSvc.cancel(ctx.admin, booking.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('forbids other employees from cancelling (403)', () => {
    const ctx = makeCtx();
    const booking = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    expect(errorCode(() => ctx.bookingSvc.cancel(ctx.otherEmployee, booking.id))).toBe('FORBIDDEN');
  });

  it('rejects cancelling twice (409) and unknown bookings (404)', () => {
    const ctx = makeCtx();
    const booking = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    ctx.bookingSvc.cancel(ctx.employee, booking.id);
    expect(errorCode(() => ctx.bookingSvc.cancel(ctx.employee, booking.id))).toBe(
      'ALREADY_CANCELLED',
    );
    expect(errorCode(() => ctx.bookingSvc.cancel(ctx.employee, 'nope'))).toBe('NOT_FOUND');
  });
});

describe('BookingService.mine — marks_completed_bookings', () => {
  it('shows past confirmed bookings as completed without mutating stored status', () => {
    const ctx = makeCtx();
    const past = ctx.bookingSvc.create(
      ctx.employee,
      bookingInput(ctx, { title: 'early standup', start: `${WED}T08:00`, end: `${WED}T09:00` }),
    );
    const future = ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    const mine = ctx.bookingSvc.mine(ctx.employee.sub);
    expect(mine).toHaveLength(2);
    expect(mine.find((b) => b.id === past.id)?.status).toBe('completed');
    expect(mine.find((b) => b.id === future.id)?.status).toBe('confirmed');

    // Stored history is untouched: the repository still holds `confirmed`.
    expect(ctx.bookings.findById(past.id)?.status).toBe('confirmed');
    expect(ctx.bookingSvc.mine(ctx.employee.sub).find((b) => b.id === past.id)?.status).toBe(
      'completed',
    );
  });

  it('keeps cancelled bookings cancelled even after their end passed', () => {
    const ctx = makeCtx();
    const past = ctx.bookingSvc.create(
      ctx.employee,
      bookingInput(ctx, { start: `${WED}T08:00`, end: `${WED}T09:00` }),
    );
    ctx.bookingSvc.cancel(ctx.admin, past.id); // admin can cancel anytime
    expect(ctx.bookingSvc.mine(ctx.employee.sub)[0].status).toBe('cancelled');
  });

  it('only returns the organizer’s own bookings', () => {
    const ctx = makeCtx();
    ctx.bookingSvc.create(ctx.employee, bookingInput(ctx));
    ctx.bookingSvc.create(
      ctx.otherEmployee,
      bookingInput(ctx, { title: 'oscar sync', start: `${WED}T13:00`, end: `${WED}T14:00` }),
    );
    expect(ctx.bookingSvc.mine(ctx.employee.sub)).toHaveLength(1);
    expect(ctx.bookingSvc.mine(ctx.employee.sub)[0].organizerId).toBe('emp-1');
  });
});
