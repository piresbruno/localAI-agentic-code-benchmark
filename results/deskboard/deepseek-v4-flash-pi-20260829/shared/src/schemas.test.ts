import { describe, expect, it } from 'vitest';
import {
  bookingCreateSchema,
  calendarDateSchema,
  changePasswordSchema,
  formatZodErrors,
  isoMinutesSchema,
  loginSchema,
  recurrenceSchema,
  registerSchema,
  roomCreateSchema,
  roomUpdateSchema,
  usageQuerySchema,
} from './schemas.js';
import { DomainError, toErrorResponse } from './errors.js';

describe('registerSchema', () => {
  it('accepts a valid registration', () => {
    const r = registerSchema.safeParse({ name: 'Ada Lovelace', email: 'ada@example.com', password: 'supersecret' });
    expect(r.success).toBe(true);
  });

  it('rejects an invalid email', () => {
    const r = registerSchema.safeParse({ name: 'Ada', email: 'not-an-email', password: 'supersecret' });
    expect(r.success).toBe(false);
    expect(formatZodErrors(r.error!).email).toBeTruthy();
  });

  it('rejects a short password', () => {
    const r = registerSchema.safeParse({ name: 'Ada', email: 'ada@example.com', password: 'short' });
    expect(r.success).toBe(false);
    expect(formatZodErrors(r.error!).password).toContain('8');
  });

  it('rejects a missing name', () => {
    const r = registerSchema.safeParse({ email: 'ada@example.com', password: 'supersecret' });
    expect(r.success).toBe(false);
    expect(formatZodErrors(r.error!).name).toBeTruthy();
  });
});

describe('loginSchema', () => {
  it('accepts email + password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.c', password: 'x' }).success).toBe(true);
  });

  it('rejects empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.c', password: '' }).success).toBe(false);
  });
});

describe('changePasswordSchema', () => {
  it('rejects new password below minimum length', () => {
    const r = changePasswordSchema.safeParse({ currentPassword: 'oldpass', newPassword: 'tiny' });
    expect(r.success).toBe(false);
    expect(formatZodErrors(r.error!).newPassword).toContain('8');
  });
});

describe('roomCreateSchema', () => {
  it('accepts a valid room', () => {
    const r = roomCreateSchema.safeParse({ name: 'Atlas', capacity: 10, floor: 3, features: ['screen', 'videoconf'] });
    expect(r.success).toBe(true);
  });

  it('rejects capacity out of range (1–100)', () => {
    expect(roomCreateSchema.safeParse({ name: 'A', capacity: 0, floor: 1, features: [] }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ name: 'A', capacity: 101, floor: 1, features: [] }).success).toBe(false);
  });

  it('rejects floor out of range (1–30)', () => {
    expect(roomCreateSchema.safeParse({ name: 'A', capacity: 5, floor: 0, features: [] }).success).toBe(false);
    expect(roomCreateSchema.safeParse({ name: 'A', capacity: 5, floor: 31, features: [] }).success).toBe(false);
  });

  it('rejects unknown and duplicate features', () => {
    expect(
      roomCreateSchema.safeParse({ name: 'A', capacity: 5, floor: 1, features: ['projector'] }).success,
    ).toBe(false);
    expect(
      roomCreateSchema.safeParse({ name: 'A', capacity: 5, floor: 1, features: ['screen', 'screen'] }).success,
    ).toBe(false);
  });
});

describe('roomUpdateSchema', () => {
  it('accepts a partial update', () => {
    expect(roomUpdateSchema.safeParse({ capacity: 12 }).success).toBe(true);
  });

  it('rejects an empty update', () => {
    expect(roomUpdateSchema.safeParse({}).success).toBe(false);
  });
});

describe('isoMinutesSchema / bookingCreateSchema', () => {
  it('accepts minute-precision ISO datetimes', () => {
    expect(isoMinutesSchema.safeParse('2026-08-30T09:00:00Z').success).toBe(true);
    expect(isoMinutesSchema.safeParse('2026-08-30T09:30:00+02:00').success).toBe(true);
  });

  it('rejects seconds or milliseconds precision', () => {
    expect(isoMinutesSchema.safeParse('2026-08-30T09:00:15Z').success).toBe(false);
    expect(isoMinutesSchema.safeParse('2026-08-30T09:00:00.500Z').success).toBe(false);
  });

  it('rejects non-datetime strings', () => {
    expect(isoMinutesSchema.safeParse('2026-08-30').success).toBe(false);
    expect(isoMinutesSchema.safeParse('tomorrow').success).toBe(false);
  });

  it('accepts a valid booking body', () => {
    const r = bookingCreateSchema.safeParse({
      roomId: 'r1',
      title: 'Sprint planning',
      start: '2026-08-30T09:00:00Z',
      durationMinutes: 60,
      attendees: 6,
      recurrence: { kind: 'weekly', count: 4 },
    });
    expect(r.success).toBe(true);
  });

  it('rejects duration not a multiple of 30', () => {
    const base = { roomId: 'r1', title: 'T', start: '2026-08-30T09:00:00Z', attendees: 1, recurrence: { kind: 'none' } };
    expect(bookingCreateSchema.safeParse({ ...base, durationMinutes: 45 }).success).toBe(false);
  });

  it('rejects duration outside 30–240 minutes', () => {
    const base = { roomId: 'r1', title: 'T', start: '2026-08-30T09:00:00Z', attendees: 1, recurrence: { kind: 'none' } };
    expect(bookingCreateSchema.safeParse({ ...base, durationMinutes: 15 }).success).toBe(false);
    expect(bookingCreateSchema.safeParse({ ...base, durationMinutes: 300 }).success).toBe(false);
  });

  it('rejects a title longer than 100 characters', () => {
    const r = bookingCreateSchema.safeParse({
      roomId: 'r1',
      title: 'x'.repeat(101),
      start: '2026-08-30T09:00:00Z',
      durationMinutes: 30,
      attendees: 1,
      recurrence: { kind: 'none' },
    });
    expect(r.success).toBe(false);
  });
});

describe('recurrenceSchema', () => {
  it('accepts none and weekly within 1–52', () => {
    expect(recurrenceSchema.safeParse({ kind: 'none' }).success).toBe(true);
    expect(recurrenceSchema.safeParse({ kind: 'weekly', count: 4 }).success).toBe(true);
  });

  it('rejects weekly counts outside 1–52', () => {
    expect(recurrenceSchema.safeParse({ kind: 'weekly', count: 0 }).success).toBe(false);
    expect(recurrenceSchema.safeParse({ kind: 'weekly', count: 53 }).success).toBe(false);
  });

  it('rejects unknown kinds', () => {
    expect(recurrenceSchema.safeParse({ kind: 'daily', count: 2 }).success).toBe(false);
  });
});

describe('calendarDateSchema / usageQuerySchema', () => {
  it('accepts YYYY-MM-DD', () => {
    expect(calendarDateSchema.safeParse('2026-08-30').success).toBe(true);
  });

  it('rejects malformed or impossible dates', () => {
    expect(calendarDateSchema.safeParse('2026-13-01').success).toBe(false);
    expect(calendarDateSchema.safeParse('30-08-2026').success).toBe(false);
  });

  it('rejects from > to', () => {
    expect(usageQuerySchema.safeParse({ from: '2026-09-02', to: '2026-09-01' }).success).toBe(false);
  });
});

describe('DomainError', () => {
  it('produces the shared error envelope', () => {
    const err = new DomainError('ROOM_CONFLICT', 'Room is already booked', { roomId: 'r1' });
    expect(toErrorResponse(err)).toEqual({
      error: { code: 'ROOM_CONFLICT', message: 'Room is already booked', details: { roomId: 'r1' } },
    });
  });

  it('omits details when absent', () => {
    const err = new DomainError('NOT_FOUND', 'missing');
    expect(err.toBody()).toEqual({ code: 'NOT_FOUND', message: 'missing' });
  });
});
