// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  registerSchema,
  loginSchema,
  bookingInputSchema,
  roomInputSchema,
  usageQuerySchema,
  passwordChangeSchema
} from './schemas.js';
import { AppError } from './errors.js';

describe('registerSchema', () => {
  it('accepts a valid registration and normalizes the email', () => {
    const r = registerSchema.parse({
      name: ' Ada ',
      email: '  Ada@Example.COM ',
      password: 'longenough1'
    });
    expect(r.name).toBe('Ada');
    expect(r.email).toBe('ada@example.com');
  });

  it('rejects short passwords', () => {
    expect(
      registerSchema.safeParse({ name: 'A', email: 'a@b.co', password: 'short' }).success
    ).toBe(false);
  });

  it('rejects invalid emails', () => {
    expect(
      registerSchema.safeParse({ name: 'A', email: 'not-an-email', password: 'longenough1' })
        .success
    ).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires an email and non-empty password', () => {
    expect(loginSchema.safeParse({ email: 'a@b.co', password: '' }).success).toBe(false);
    expect(loginSchema.parse({ email: 'A@B.CO', password: 'x' }).email).toBe('a@b.co');
  });
});

describe('passwordChangeSchema', () => {
  it('requires a current password and a strong new one', () => {
    expect(
      passwordChangeSchema.safeParse({ currentPassword: '', newPassword: 'longenough1' }).success
    ).toBe(false);
    expect(
      passwordChangeSchema.safeParse({ currentPassword: 'x', newPassword: 'short' }).success
    ).toBe(false);
  });
});

describe('roomInputSchema', () => {
  it('accepts a room with known features only', () => {
    const r = roomInputSchema.parse({
      name: 'Kiwi',
      capacity: 8,
      floor: 3,
      features: ['screen', 'videoconf']
    });
    expect(r.features).toEqual(['screen', 'videoconf']);
  });

  it('rejects unknown features and out-of-range capacity/floor', () => {
    expect(
      roomInputSchema.safeParse({ name: 'X', capacity: 8, floor: 3, features: ['pool'] }).success
    ).toBe(false);
    expect(
      roomInputSchema.safeParse({ name: 'X', capacity: 101, floor: 3, features: [] }).success
    ).toBe(false);
    expect(
      roomInputSchema.safeParse({ name: 'X', capacity: 5, floor: 31, features: [] }).success
    ).toBe(false);
  });

  it('defaults features to an empty list', () => {
    const r = roomInputSchema.parse({ name: 'Solo', capacity: 1, floor: 1 });
    expect(r.features).toEqual([]);
  });
});

describe('bookingInputSchema', () => {
  const base = {
    roomId: 'r1',
    title: 'Kickoff',
    start: '2026-09-01T09:00',
    durationMinutes: 60,
    attendees: 4
  };

  it('accepts a plain booking and defaults recurrence to none', () => {
    const b = bookingInputSchema.parse(base);
    expect(b.recurrence).toEqual({ kind: 'none' });
  });

  it('accepts a weekly recurrence with count 2–12', () => {
    const b = bookingInputSchema.parse({ ...base, recurrence: { kind: 'weekly', count: 4 } });
    expect(b.recurrence).toEqual({ kind: 'weekly', count: 4 });
  });

  it('rejects weekly counts below 2 or above 12', () => {
    expect(
      bookingInputSchema.safeParse({ ...base, recurrence: { kind: 'weekly', count: 1 } }).success
    ).toBe(false);
    expect(
      bookingInputSchema.safeParse({ ...base, recurrence: { kind: 'weekly', count: 13 } }).success
    ).toBe(false);
  });

  it('rejects start values with seconds precision', () => {
    expect(
      bookingInputSchema.safeParse({ ...base, start: '2026-09-01T09:00:00' }).success
    ).toBe(false);
  });

  it('rejects durations outside the 30/60/90/120 set', () => {
    expect(bookingInputSchema.safeParse({ ...base, durationMinutes: 45 }).success).toBe(false);
  });

  it('rejects empty titles', () => {
    expect(bookingInputSchema.safeParse({ ...base, title: '   ' }).success).toBe(false);
  });

  it('rejects unknown extra fields', () => {
    expect(bookingInputSchema.safeParse({ ...base, hacking: true }).success).toBe(false);
  });
});

describe('usageQuerySchema', () => {
  it('accepts an ordered date range', () => {
    expect(usageQuerySchema.parse({ from: '2026-09-01', to: '2026-09-30' })).toEqual({
      from: '2026-09-01',
      to: '2026-09-30'
    });
  });

  it('rejects an inverted range', () => {
    expect(
      usageQuerySchema.safeParse({ from: '2026-09-30', to: '2026-09-01' }).success
    ).toBe(false);
  });
});

describe('AppError', () => {
  it('maps codes to HTTP statuses per the error contract', () => {
    expect(new AppError('VALIDATION_ERROR', 'x').httpStatus).toBe(400);
    expect(new AppError('UNAUTHENTICATED', 'x').httpStatus).toBe(401);
    expect(new AppError('FORBIDDEN', 'x').httpStatus).toBe(403);
    expect(new AppError('NOT_FOUND', 'x').httpStatus).toBe(404);
    expect(new AppError('ROOM_CONFLICT', 'x').httpStatus).toBe(409);
    expect(new AppError('RULE_VIOLATION', 'x').httpStatus).toBe(422);
  });

  it('serializes with details only when provided', () => {
    expect(new AppError('NOT_FOUND', 'no room').toJSON()).toEqual({
      code: 'NOT_FOUND',
      message: 'no room'
    });
    expect(new AppError('RULE_VIOLATION', 'too many', { capacity: 6 }).toJSON()).toEqual({
      code: 'RULE_VIOLATION',
      message: 'too many',
      details: { capacity: 6 }
    });
  });
});
