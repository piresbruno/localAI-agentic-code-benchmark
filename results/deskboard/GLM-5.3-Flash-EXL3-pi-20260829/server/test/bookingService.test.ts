/** Unit tests for BookingService business rules, with injected Clock/IdGen and in-memory repos. */
import { beforeEach, describe, expect, it } from 'vitest';
import { DomainError } from '@deskboard/shared';
import { BookingService } from '../src/services/bookingService.js';
import { AuthService } from '../src/services/authService.js';
import { RoomService } from '../src/services/roomService.js';
import { InMemoryBookingRepository, InMemoryRoomRepository, InMemoryUserRepository } from '../src/repositories/inMemory.js';
import { TokenService } from '../src/auth/tokens.js';
import { FixedClock, SeqIdGen } from './helpers.js';

interface Ctx {
  bookings: BookingService;
  rooms: RoomService;
  auth: AuthService;
  clock: FixedClock;
  roomId: string;
  employee: { id: string; token: string };
  admin: { id: string; token: string };
  adminActor: { id: string; name: string; email: string; role: 'admin'; createdAt: string };
}

async function setup(): Promise<Ctx> {
  const clock = new FixedClock('2026-08-31T08:00:00'); // Monday 08:00
  const idGen = new SeqIdGen();
  const users = new InMemoryUserRepository();
  const roomRepo = new InMemoryRoomRepository();
  const bookingRepo = new InMemoryBookingRepository();
  const tokens = new TokenService('test-secret');

  const auth = new AuthService({ users, clock, idGen, tokens });
  const rooms = new RoomService({ rooms: roomRepo, clock, idGen });
  const bookings = new BookingService({ bookings: bookingRepo, rooms: roomRepo, users, clock, idGen });

  const employee = await auth.register({ name: 'Emp', email: 'emp@x.io', password: 'password123' });
  const adminUser = await auth.register({ name: 'Adm', email: 'adm@x.io', password: 'password123' });
  // Promote second user to admin directly (admin accounts normally come from seeding).
  users.create(
    { id: adminUser.user.id, name: 'Adm', email: 'adm@x.io', role: 'admin', createdAt: adminUser.user.createdAt },
    'unused-in-unit-tests',
  );
  const adminActor = { id: adminUser.user.id, name: 'Adm', email: 'adm@x.io', role: 'admin' as const, createdAt: '' };
  const room = rooms.create(adminActor, {
    name: 'Room X',
    capacity: 10,
    floor: 2,
    features: [],
    active: true,
  });

  return { bookings, rooms, auth, clock, roomId: room.id, employee, admin: { id: adminUser.user.id, token: adminUser.token }, adminActor };
}

let ctx: Ctx;
beforeEach(async () => {
  ctx = await setup();
});

const employeeActor = (id: string) => ({ id, name: 'Emp', email: 'emp@x.io', role: 'employee' as const, createdAt: '' });
const adminActor = (ctx: Ctx) => ctx.adminActor;

describe('BookingService.create', () => {
  it('rejects booking when room does not exist', async () => {
    await expect(
      ctx.bookings.create(employeeActor(ctx.employee.id), {
        roomId: 'nope',
        title: 'Standup',
        start: '2026-08-31T09:00',
        end: '2026-08-31T10:00',
        attendees: 2,
        recurrence: { kind: 'none' },
      }),
    ).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('rejects booking outside business hours (weekend occurrence)', async () => {
    await expect(
      ctx.bookings.create(employeeActor(ctx.employee.id), {
        roomId: ctx.roomId,
        title: 'Weekend work',
        start: '2026-09-05T09:00', // Saturday
        end: '2026-09-05T10:00',
        attendees: 2,
        recurrence: { kind: 'none' },
      }),
    ).rejects.toMatchObject({ code: 'RULE_VIOLATION' });
  });

  it('rejects booking when room already booked (overlap) with ROOM_CONFLICT', async () => {
    const actor = employeeActor(ctx.employee.id);
    await ctx.bookings.create(actor, {
      roomId: ctx.roomId,
      title: 'First',
      start: '2026-08-31T09:00',
      end: '2026-08-31T10:00',
      attendees: 2,
      recurrence: { kind: 'none' },
    });
    await expect(
      ctx.bookings.create(actor, {
        roomId: ctx.roomId,
        title: 'Overlapping',
        start: '2026-08-31T09:30',
        end: '2026-08-31T10:30',
        attendees: 2,
        recurrence: { kind: 'none' },
      }),
    ).rejects.toSatisfy((e: DomainError) => e.code === 'ROOM_CONFLICT' && (e as DomainError).message.length > 0);
  });

  it('allows back-to-back adjacent bookings on the same room', async () => {
    const actor = employeeActor(ctx.employee.id);
    await ctx.bookings.create(actor, {
      roomId: ctx.roomId,
      title: 'First',
      start: '2026-08-31T09:00',
      end: '2026-08-31T10:00',
      attendees: 2,
      recurrence: { kind: 'none' },
    });
    await expect(
      ctx.bookings.create(actor, {
        roomId: ctx.roomId,
        title: 'Adjacent',
        start: '2026-08-31T10:00',
        end: '2026-08-31T11:00',
        attendees: 2,
        recurrence: { kind: 'none' },
      }),
    ).resolves.toMatchObject({ title: 'Adjacent' });
  });

  it('ignores cancelled bookings when checking conflicts', async () => {
    const actor = employeeActor(ctx.employee.id);
    const first = await ctx.bookings.create(actor, {
      roomId: ctx.roomId,
      title: 'To cancel',
      start: '2026-08-31T09:00',
      end: '2026-08-31T10:00',
      attendees: 2,
      recurrence: { kind: 'none' },
    });
    await ctx.bookings.cancel(actor, first.id);
    await expect(
      ctx.bookings.create(actor, {
        roomId: ctx.roomId,
        title: 'Replacement',
        start: '2026-08-31T09:00',
        end: '2026-08-31T10:00',
        attendees: 2,
        recurrence: { kind: 'none' },
      }),
    ).resolves.toMatchObject({ title: 'Replacement' });
  });

  it('expands weekly recurrence — creates count occurrences 7 days apart', async () => {
    const view = await ctx.bookings.create(employeeActor(ctx.employee.id), {
      roomId: ctx.roomId,
      title: 'Weekly sync',
      start: '2026-08-31T09:00',
      end: '2026-08-31T10:00',
      attendees: 2,
      recurrence: { kind: 'weekly', count: 3 },
    });
    expect(view.occurrences.map((o) => o.start)).toEqual([
      '2026-08-31T09:00',
      '2026-09-07T09:00',
      '2026-09-14T09:00',
    ]);
  });

  it('rejects the whole weekly booking when ANY occurrence conflicts', async () => {
    const actor = employeeActor(ctx.employee.id);
    await ctx.bookings.create(actor, {
      roomId: ctx.roomId,
      title: 'Blocker in week 2',
      start: '2026-09-07T09:00',
      end: '2026-09-07T10:00',
      attendees: 2,
      recurrence: { kind: 'none' },
    });
    await expect(
      ctx.bookings.create(actor, {
        roomId: ctx.roomId,
        title: 'Weekly series',
        start: '2026-08-31T09:00',
        end: '2026-08-31T10:00',
        attendees: 2,
        recurrence: { kind: 'weekly', count: 3 },
      }),
    ).rejects.toMatchObject({ code: 'ROOM_CONFLICT' });
  });

  it('rejects booking over capacity with 422', async () => {
    await expect(
      ctx.bookings.create(employeeActor(ctx.employee.id), {
        roomId: ctx.roomId,
        title: 'Too many people',
        start: '2026-08-31T09:00',
        end: '2026-08-31T10:00',
        attendees: 11,
        recurrence: { kind: 'none' },
      }),
    ).rejects.toMatchObject({ code: 'RULE_VIOLATION', message: /capacity/ });
  });

  it('blocks new bookings on a deactivated room but keeps existing ones', async () => {
    const actor = employeeActor(ctx.employee.id);
    const existing = await ctx.bookings.create(actor, {
      roomId: ctx.roomId,
      title: 'Before deactivation',
      start: '2026-08-31T09:00',
      end: '2026-08-31T10:00',
      attendees: 2,
      recurrence: { kind: 'none' },
    });
    ctx.rooms.deactivate(adminActor(ctx), ctx.roomId);
    await expect(
      ctx.bookings.create(actor, {
        roomId: ctx.roomId,
        title: 'After deactivation',
        start: '2026-08-31T11:00',
        end: '2026-08-31T12:00',
        attendees: 2,
        recurrence: { kind: 'none' },
      }),
    ).rejects.toMatchObject({ code: 'RULE_VIOLATION', message: /deactivated/ });
    // Existing booking still readable and untouched.
    expect((await ctx.bookings.listMine(actor)).map((b) => b.id)).toContain(existing.id);
  });
});

describe('BookingService.cancel — enforces_cancellation_window', () => {
  async function bookingAt(start: string, end: string) {
    return ctx.bookings.create(employeeActor(ctx.employee.id), {
      roomId: ctx.roomId,
      title: 'Cancellable',
      start,
      end,
      attendees: 2,
      recurrence: { kind: 'none' },
    });
  }

  it('organizer cancels more than 1h before start', async () => {
    const booking = await bookingAt('2026-08-31T12:00', '2026-08-31T13:00'); // now 08:00
    await expect(ctx.bookings.cancel(employeeActor(ctx.employee.id), booking.id)).resolves.toMatchObject({
      status: 'cancelled',
    });
  });

  it('organizer cannot cancel within 1h of the start', async () => {
    const booking = await bookingAt('2026-08-31T08:30', '2026-08-31T09:30'); // now 08:00 → window is 07:30
    await expect(ctx.bookings.cancel(employeeActor(ctx.employee.id), booking.id)).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: /1 hour/,
    });
  });

  it('admin can cancel any booking anytime', async () => {
    const booking = await bookingAt('2026-08-31T08:30', '2026-08-31T09:30');
    await expect(ctx.bookings.cancel(adminActor(ctx), booking.id)).resolves.toMatchObject({ status: 'cancelled' });
  });

  it('another employee can never cancel someone else\'s booking (403)', async () => {
    const other = await ctx.auth.register({ name: 'Other', email: 'other@x.io', password: 'password123' });
    const booking = await bookingAt('2026-08-31T12:00', '2026-08-31T13:00');
    await expect(ctx.bookings.cancel(employeeActor(other.user.id), booking.id)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('returns 404 for unknown booking id', async () => {
    await expect(ctx.bookings.cancel(employeeActor(ctx.employee.id), 'missing')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('BookingService listing & availability', () => {
  it('listMine returns only the caller\'s bookings sorted by start', async () => {
    const actor = employeeActor(ctx.employee.id);
    const other = await ctx.auth.register({ name: 'Other', email: 'other2@x.io', password: 'password123' });
    await ctx.bookings.create(actor, {
      roomId: ctx.roomId, title: 'Later', start: '2026-08-31T11:00', end: '2026-08-31T12:00', attendees: 1, recurrence: { kind: 'none' },
    });
    await ctx.bookings.create(actor, {
      roomId: ctx.roomId, title: 'Earlier', start: '2026-08-31T09:00', end: '2026-08-31T10:00', attendees: 1, recurrence: { kind: 'none' },
    });
    await ctx.bookings.create(employeeActor(other.user.id), {
      roomId: ctx.roomId, title: 'Not mine', start: '2026-08-31T13:00', end: '2026-08-31T14:00', attendees: 1, recurrence: { kind: 'none' },
    });
    const mine = await ctx.bookings.listMine(actor);
    expect(mine.map((b) => b.title)).toEqual(['Earlier', 'Later']);
  });

  it('availability returns hourly free/busy slots 08:00–19:00 with occupants', async () => {
    const actor = employeeActor(ctx.employee.id);
    await ctx.bookings.create(actor, {
      roomId: ctx.roomId, title: 'Morning', start: '2026-08-31T09:00', end: '2026-08-31T10:30', attendees: 1, recurrence: { kind: 'none' },
    });
    const grid = await ctx.bookings.availability(ctx.roomId, '2026-08-31');
    expect(grid.slots).toHaveLength(11);
    expect(grid.slots[0]).toMatchObject({ time: '08:00', bookingId: null });
    expect(grid.slots[1]).toMatchObject({ time: '09:00', bookingTitle: 'Morning' });
    expect(grid.slots[2]).toMatchObject({ time: '10:00', bookingTitle: 'Morning' }); // multi-hour spans slots
    expect(grid.slots[3].bookingId).toBeNull();
  });

  it('availability shows weekly occurrences on their actual dates', async () => {
    const actor = employeeActor(ctx.employee.id);
    await ctx.bookings.create(actor, {
      roomId: ctx.roomId, title: 'Weekly', start: '2026-08-31T09:00', end: '2026-08-31T10:00', attendees: 1, recurrence: { kind: 'weekly', count: 2 },
    });
    const week2 = await ctx.bookings.availability(ctx.roomId, '2026-09-07');
    expect(week2.slots[1]).toMatchObject({ bookingTitle: 'Weekly' });
  });
});
