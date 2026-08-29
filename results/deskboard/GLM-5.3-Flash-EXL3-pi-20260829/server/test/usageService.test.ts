/** Unit tests for the admin usage report service. */
import { describe, expect, it } from 'vitest';
import { UsageService } from '../src/services/usageService.js';
import { BookingService } from '../src/services/bookingService.js';
import { AuthService } from '../src/services/authService.js';
import { RoomService } from '../src/services/roomService.js';
import { InMemoryBookingRepository, InMemoryRoomRepository, InMemoryUserRepository } from '../src/repositories/inMemory.js';
import { TokenService } from '../src/auth/tokens.js';
import { FixedClock, SeqIdGen } from './helpers.js';

async function setup() {
  const clock = new FixedClock('2026-08-31T08:00:00');
  const idGen = new SeqIdGen();
  const users = new InMemoryUserRepository();
  const roomRepo = new InMemoryRoomRepository();
  const bookingRepo = new InMemoryBookingRepository();
  const tokens = new TokenService('test-secret');
  const auth = new AuthService({ users, clock, idGen, tokens });
  const rooms = new RoomService({ rooms: roomRepo, clock, idGen });
  const bookings = new BookingService({ bookings: bookingRepo, rooms: roomRepo, users, clock, idGen });
  const usage = new UsageService({ bookings: bookingRepo, rooms: roomRepo, users });

  const emp = await auth.register({ name: 'Emp', email: 'emp@x.io', password: 'password123' });
  const emp2 = await auth.register({ name: 'Emp Two', email: 'emp2@x.io', password: 'password123' });
  const adminActor = { id: 'admin-1', name: 'Admin', email: 'a@x.io', role: 'admin' as const, createdAt: '' };
  const r1 = rooms.create(adminActor, { name: 'Room One', capacity: 10, floor: 1, features: [], active: true });
  const r2 = rooms.create(adminActor, { name: 'Room Two', capacity: 10, floor: 1, features: [], active: true });
  return { bookings, rooms, usage, emp, emp2, adminActor, r1, r2 };
}

const asActor = (u: { user: { id: string; name: string; email: string; createdAt: string } }) => ({
  id: u.user.id,
  name: u.user.name,
  email: u.user.email,
  role: 'employee' as const,
  createdAt: u.user.createdAt,
});

describe('UsageService', () => {
  it('forbids non-admin access', async () => {
    const ctx = await setup();
    expect(() => ctx.usage.report({ role: 'employee' }, '2026-08-31', '2026-09-06')).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
  });

  it('computes per-room booked minutes, counts, and top organizer; skips cancelled and out-of-window bookings', async () => {
    const ctx = await setup();
    const empActor = asActor(ctx.emp);
    const emp2Actor = asActor(ctx.emp2);

    await ctx.bookings.create(empActor, {
      roomId: ctx.r1.id, title: 'Two hours', start: '2026-08-31T09:00', end: '2026-08-31T11:00', attendees: 2, recurrence: { kind: 'none' },
    });
    await ctx.bookings.create(empActor, {
      roomId: ctx.r1.id, title: 'One hour', start: '2026-09-01T09:00', end: '2026-09-01T10:00', attendees: 2, recurrence: { kind: 'none' },
    });
    await ctx.bookings.create(emp2Actor, {
      roomId: ctx.r1.id, title: 'Four hours', start: '2026-09-02T09:00', end: '2026-09-02T13:00', attendees: 2, recurrence: { kind: 'none' },
    });
    const cancelled = await ctx.bookings.create(empActor, {
      roomId: ctx.r1.id, title: 'Cancelled', start: '2026-09-03T09:00', end: '2026-09-03T12:00', attendees: 2, recurrence: { kind: 'none' },
    });
    await ctx.bookings.cancel(empActor, cancelled.id);
    await ctx.bookings.create(empActor, {
      roomId: ctx.r2.id, title: 'Elsewhere', start: '2026-08-31T13:00', end: '2026-08-31T14:00', attendees: 1, recurrence: { kind: 'none' },
    });
    // Outside the report window — must be excluded.
    await ctx.bookings.create(empActor, {
      roomId: ctx.r2.id, title: 'Too late', start: '2026-09-24T13:00', end: '2026-09-24T14:00', attendees: 1, recurrence: { kind: 'none' },
    });

    const report = ctx.usage.report({ role: 'admin' }, '2026-08-31', '2026-09-06');
    const roomOne = report.find((r) => r.roomId === ctx.r1.id)!;
    expect(roomOne.totalBookedMinutes).toBe(420); // 120 + 60 + 240
    expect(roomOne.bookingCount).toBe(3);
    expect(roomOne.topOrganizer).toBe('Emp Two'); // 240 booked minutes, the most in the window
    const roomTwo = report.find((r) => r.roomId === ctx.r2.id)!;
    expect(roomTwo.totalBookedMinutes).toBe(60);
    expect(roomTwo.bookingCount).toBe(1);
    expect(roomTwo.topOrganizer).toBe('Emp');
  });

  it('counts weekly recurrence occurrences individually in usage', async () => {
    const ctx = await setup();
    const empActor = asActor(ctx.emp);
    await ctx.bookings.create(empActor, {
      roomId: ctx.r1.id, title: 'Weekly', start: '2026-08-31T09:00', end: '2026-08-31T10:00', attendees: 2, recurrence: { kind: 'weekly', count: 3 },
    });
    const report = ctx.usage.report({ role: 'admin' }, '2026-08-31', '2026-09-30');
    const roomOne = report.find((r) => r.roomId === ctx.r1.id)!;
    expect(roomOne.totalBookedMinutes).toBe(180);
    expect(roomOne.bookingCount).toBe(3);
  });
});
