// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryBookingRepository,
  InMemoryRoomRepository,
  InMemoryUserRepository,
  type BookingRepository,
  type RoomRepository,
  type UserRepository
} from '../repositories/index.js';
import { fixedClock, sequentialIdGen } from './clock.js';
import { BookingService } from './bookingService.js';
import { hashPassword } from '../auth/password.js';
import { AppError } from 'deskboard-shared';
import type { BookingPayload, StoredUser } from 'deskboard-shared';

/**
 * Test-time anchor: a Monday, since business-hours rules are Mon–Fri.
 * Dates are built with local-time Date arithmetic so the suite is
 * timezone-independent.
 */
const mondayBase = (): Date => {
  const d = new Date(2026, 8, 1); // Tue 2026-09-01
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return d;
};

const pad = (n: number) => String(n).padStart(2, '0');
/** Local ISO datetime: Monday + dayOffset at hour:min. */
const at = (dayOffset: number, hour: number, min = 0): string => {
  const d = mondayBase();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(hour, min, 0, 0);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const NOW = at(0, 9, 0); // Monday 09:00

interface Ctx {
  bookings: BookingRepository;
  rooms: RoomRepository;
  users: UserRepository;
  service: BookingService;
  roomId: string;
  organizer: StoredUser;
}

const setup = (): Ctx => {
  const bookings = new InMemoryBookingRepository();
  const rooms = new InMemoryRoomRepository();
  const users = new InMemoryUserRepository();
  const service = new BookingService({
    bookings,
    rooms,
    users,
    clock: fixedClock(NOW),
    ids: sequentialIdGen('b')
  });
  const organizer = users.create({
    id: 'u-1',
    name: 'Olive Organizer',
    email: 'olive@deskboard.local',
    role: 'employee',
    passwordHash: hashPassword('password123'),
    createdAt: NOW
  });
  const room = rooms.create({
    id: 'r-1',
    name: 'Kiwi',
    capacity: 6,
    floor: 2,
    features: ['screen'],
    active: true,
    createdAt: NOW
  });
  return { bookings, rooms, users, service, roomId: room.id, organizer };
};

const input = (over: Partial<BookingPayload> = {}): BookingPayload => ({
  roomId: 'r-1',
  title: 'Standup',
  start: at(0, 10, 0),
  durationMinutes: 60,
  attendees: 3,
  recurrence: { kind: 'none' },
  ...over
});

describe('booking rules', () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = setup();
  });

  it('rejects_booking_outside_business_hours — before 08:00, after 19:00, weekends, inverted and >4h', () => {
    const { service } = ctx;
    expect(() => service.create('u-1', input({ start: at(0, 7, 30) }))).toThrowError(/business hours/);
    expect(() => service.create('u-1', input({ start: at(0, 18, 0), durationMinutes: 120 }))).toThrowError(
      /business hours/
    );
    // Saturday (Monday + 5)
    expect(() => service.create('u-1', input({ start: at(5, 10, 0) }))).toThrowError(/Monday to Friday/);
    // A short booking inside hours is accepted (end-after-start is derived from duration)
    expect(
      () => service.create('u-1', input({ start: at(0, 10, 0), durationMinutes: 30 }))
    ).not.toThrow();
  });

  it('accepts a booking within business hours and stores it confirmed', () => {
    const created = ctx.service.create('u-1', input());
    expect(created).toHaveLength(1);
    expect(created[0].status).toBe('confirmed');
    expect(created[0].end).toBe(at(0, 11, 0));
  });

  it('rejects_booking_when_room_already_booked — overlap 409 ROOM_CONFLICT, adjacent allowed', () => {
    const { service } = ctx;
    service.create('u-1', input({ start: at(0, 10, 0), durationMinutes: 60 }));
    // Overlapping start
    try {
      service.create('u-1', input({ start: at(0, 10, 30), durationMinutes: 60 }));
      expect.unreachable('expected conflict');
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).code).toBe('ROOM_CONFLICT');
      expect((err as AppError).httpStatus).toBe(409);
    }
    // Back-to-back is allowed (10:00–11:00 then 11:00–12:00)
    const adjacent = service.create('u-1', input({ start: at(0, 11, 0) }));
    expect(adjacent).toHaveLength(1);
  });

  it('expands_weekly_recurrence — N occurrences 7 days apart, all-or-nothing on conflict', () => {
    const { service, bookings } = ctx;
    const created = service.create(
      'u-1',
      input({ start: at(0, 14, 0), recurrence: { kind: 'weekly', count: 3 } })
    );
    expect(created).toHaveLength(3);
    expect(created[1].start).toBe(at(7, 14, 0));
    expect(created[2].start).toBe(at(14, 14, 0));
    expect(new Set(created.map((b) => b.groupId)).size).toBe(1);
    expect(created[0].seriesCount).toBe(3);

    // Conflict in ANY occurrence rejects the whole booking: occupy week 2.
    service.create('u-1', input({ start: at(7, 15, 30), title: 'Blocker' }));
    const before = bookings.list({}).length;
    expect(() =>
      service.create('u-1', input({ start: at(0, 15, 0), recurrence: { kind: 'weekly', count: 3 } }))
    ).toThrowError(/already booked/);
    expect(bookings.list({}).length).toBe(before); // nothing persisted
  });

  it('rejects_booking_over_capacity — attendees above room capacity 422 RULE_VIOLATION', () => {
    const { service } = ctx;
    try {
      service.create('u-1', input({ attendees: 7 }));
      expect.unreachable('expected capacity rejection');
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe('RULE_VIOLATION');
      expect(e.httpStatus).toBe(422);
      expect(e.details).toMatchObject({ capacity: 6, attendees: 7 });
    }
    // At capacity is fine
    expect(() => service.create('u-1', input({ attendees: 6 }))).not.toThrow();
  });

  it('enforces_cancellation_window — organizer ≥1h before, admin anytime, others 403', () => {
    const { service } = ctx;
    const admin = ctx.users.create({
      id: 'u-admin',
      name: 'Ada Admin',
      email: 'ada@deskboard.local',
      role: 'admin',
      passwordHash: hashPassword('password123'),
      createdAt: NOW
    });
    const stranger = ctx.users.create({
      id: 'u-2',
      name: 'Sam Stranger',
      email: 'sam@deskboard.local',
      role: 'employee',
      passwordHash: hashPassword('password123'),
      createdAt: NOW
    });

    // Booking starts 09:30, now is 09:00 → inside the 1h window → 422
    const soon = service.create('u-1', input({ start: at(0, 9, 30), durationMinutes: 30 }));
    try {
      service.cancel({ id: 'u-1', role: 'employee' }, soon[0].id);
      expect.unreachable('expected window rejection');
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe('RULE_VIOLATION');
      expect(e.httpStatus).toBe(422);
    }

    // Admin can cancel the same booking anytime
    const cancelled = service.cancel({ id: admin.id, role: 'admin' }, soon[0].id);
    expect(cancelled.status).toBe('cancelled');

    // A non-organizer employee gets 403
    const other = service.create('u-1', input({ start: at(1, 10, 0) }));
    try {
      service.cancel({ id: stranger.id, role: 'employee' }, other[0].id);
      expect.unreachable('expected forbidden');
    } catch (err) {
      expect((err as AppError).code).toBe('FORBIDDEN');
    }

    // Organizer outside the window can cancel
    const tomorrow = service.create('u-1', input({ start: at(2, 10, 0) }));
    const mine = service.cancel({ id: 'u-1', role: 'employee' }, tomorrow[0].id);
    expect(mine.status).toBe('cancelled');

    // Cancelling twice → 409
    expect(() => service.cancel({ id: 'u-1', role: 'employee' }, mine.id)).toThrowError(
      /already cancelled/
    );
  });

  it('marks_completed_bookings — computed on read, history never mutated', () => {
    const { service, bookings } = ctx;
    // Booking already ended (08:00–09:00, now 09:00... use yesterday? Mon–Fri: start 08:00 end 09:00 today)
    const past = service.create('u-1', input({ start: at(0, 8, 0), durationMinutes: 60 }));
    const dto = service.listMine('u-1').find((b) => b.id === past[0].id)!;
    expect(dto.status).toBe('completed');
    // Stored status is untouched
    expect(bookings.findById(past[0].id)!.status).toBe('confirmed');

    // Future booking stays confirmed
    const future = service.create('u-1', input({ start: at(1, 10, 0) }));
    expect(service.listMine('u-1').find((b) => b.id === future[0].id)!.status).toBe('confirmed');
  });

  it('rejects bookings for unknown rooms and for deactivated rooms', () => {
    const { service, rooms } = ctx;
    expect(() => service.create('u-1', input({ roomId: 'nope' }))).toThrowError(/not found/i);
    const dead = rooms.save({ ...ctx.rooms.findById('r-1')!, active: false });
    expect(() => service.create('u-1', input({ roomId: dead.id }))).toThrowError(/deactivated/);
  });

  it('lists admin view for all organizers and employee view scoped to self', () => {
    const { service, users } = ctx;
    const other = users.create({
      id: 'u-3',
      name: 'Pat Peer',
      email: 'pat@deskboard.local',
      role: 'employee',
      passwordHash: hashPassword('password123'),
      createdAt: NOW
    });
    service.create('u-1', input({ start: at(0, 10, 0) }));
    service.create(other.id, input({ start: at(0, 15, 0), title: 'Peer session' }));

    const asAdmin = service.list({ id: 'u-admin', role: 'admin' }, {});
    expect(asAdmin).toHaveLength(2);
    const asEmployee = service.list({ id: 'u-1', role: 'employee' }, {});
    expect(asEmployee).toHaveLength(1);
    expect(asEmployee[0].organizer.id).toBe('u-1');
    // Date filter
    expect(service.list({ id: 'u-admin', role: 'admin' }, { date: at(3, 0, 0).slice(0, 10) })).toHaveLength(0);
  });
});
