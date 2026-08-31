import { ERROR_CODES, Room } from '@deskboard/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  MemoryBookingRepository,
  MemoryRoomRepository,
} from '../src/repositories/memory';
import { StoredBooking } from '../src/repositories/types';
import { AppError } from '../src/services/errors';
import { BookingService, CreateBookingCommand } from '../src/services/bookingService';
import { Clock, IdGen } from '../src/services/ports';

/* ---- deterministic fixtures (no wall clock, no randomness) ------------- */

let now: Date;
let seq = 0;
const clock: Clock = { now: () => now };
const ids: IdGen = { next: () => `b${++seq}` };

let rooms: MemoryRoomRepository;
let bookings: MemoryBookingRepository;
let service: BookingService;

const room: Room = {
  id: 'room-1',
  name: 'Hudson',
  capacity: 8,
  floor: 3,
  features: ['screen'],
  active: true,
};
const otherRoom: Room = { ...room, id: 'room-2', name: 'Erie', capacity: 4, floor: 2 };

/** Naive local ISO string for Sep 2026, e.g. iso(1, 9, 30) === '2026-09-01T09:30'. */
const iso = (day: number, hour: number, minute = 0): string =>
  `2026-09-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:${String(
    minute,
  ).padStart(2, '0')}`;

const cmd = (overrides: Partial<CreateBookingCommand> = {}): CreateBookingCommand => ({
  roomId: room.id,
  title: 'Sprint planning',
  start: iso(1, 9),
  end: iso(1, 10),
  attendees: 3,
  ...overrides,
});

const seedBooking = async (overrides: Partial<StoredBooking> = {}): Promise<StoredBooking> =>
  bookings.create({
    id: 'seed-1',
    roomId: room.id,
    title: 'Seeded booking',
    organizerId: 'user-1',
    start: new Date(2026, 8, 1, 9, 0),
    end: new Date(2026, 8, 1, 10, 0),
    status: 'confirmed',
    attendees: 2,
    createdAt: new Date(2026, 8, 1, 7, 0),
    ...overrides,
  });

beforeEach(async () => {
  now = new Date(2026, 8, 1, 8, 0);
  seq = 0;
  rooms = new MemoryRoomRepository();
  bookings = new MemoryBookingRepository();
  await rooms.create(room);
  await rooms.create(otherRoom);
  service = new BookingService(bookings, rooms, clock, ids);
});

const expectError = (
  promise: Promise<unknown>,
  code: string,
  status: number,
): Promise<void> =>
  promise.then(
    () => Promise.reject(new Error('expected the call to fail')),
    (error: unknown) => {
      expect(error).toBeInstanceOf(AppError);
      expect((error as AppError).code).toBe(code);
      expect((error as AppError).status).toBe(status);
    },
  );

/* ----------------------------------------------------------------------- */

describe('BookingService.create', () => {
  it('creates a booking with injected id/clock and confirmed status', async () => {
    const created = await service.create('user-1', cmd());
    expect(created.id).toBe('b1');
    expect(created.roomName).toBe('Hudson');
    expect(created.status).toBe('confirmed');
    expect(created.start).toBe(new Date(2026, 8, 1, 9, 0).toISOString());
  });

  it('rejects_booking_outside_business_hours on a weekend', async () => {
    await expectError(
      service.create('user-1', cmd({ start: iso(5, 10), end: iso(5, 11) })), // Saturday
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
  });

  it('rejects_booking_outside_business_hours before 08:00', async () => {
    await expectError(
      service.create('user-1', cmd({ start: iso(1, 7), end: iso(1, 8) })),
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
  });

  it('rejects_booking_outside_business_hours with an end after 19:00', async () => {
    await expectError(
      service.create('user-1', cmd({ start: iso(1, 18, 30), end: iso(1, 19, 15) })),
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
  });

  it('rejects_booking_outside_business_hours when end is not after start', async () => {
    await expectError(
      service.create('user-1', cmd({ start: iso(1, 10), end: iso(1, 9) })),
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
    await expectError(
      service.create('user-1', cmd({ start: iso(1, 10), end: iso(1, 10) })),
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
  });

  it('rejects_booking_outside_business_hours when longer than 4 hours', async () => {
    await expectError(
      service.create('user-1', cmd({ start: iso(1, 9), end: iso(1, 13, 1) })),
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
  });

  it('accepts boundary bookings: 08:00 start, 19:00 end, exactly 4 hours', async () => {
    const created = await service.create(
      'user-1',
      cmd({ start: iso(1, 15), end: iso(1, 19) }),
    );
    expect(created.status).toBe('confirmed');
  });

  it('rejects_booking_when_room_already_booked on overlap', async () => {
    await seedBooking();
    await expectError(
      service.create('user-2', cmd({ start: iso(1, 9, 30), end: iso(1, 10, 30) })),
      ERROR_CODES.ROOM_CONFLICT,
      409,
    );
  });

  it('allows back-to-back bookings (adjacent slots do not overlap)', async () => {
    await seedBooking({ start: new Date(2026, 8, 1, 9, 0), end: new Date(2026, 8, 1, 10, 0) });
    const created = await service.create(
      'user-2',
      cmd({ start: iso(1, 10), end: iso(1, 11) }),
    );
    expect(created.status).toBe('confirmed');
  });

  it('does not treat a cancelled booking as a conflict', async () => {
    const seeded = await seedBooking();
    await service.cancel('user-1', 'employee', seeded.id);
    const created = await service.create(
      'user-2',
      cmd({ start: iso(1, 9, 30), end: iso(1, 10, 30) }),
    );
    expect(created.status).toBe('confirmed');
  });

  it('ignores bookings in other rooms when checking conflicts', async () => {
    await bookings.create({
      id: 'seed-2',
      roomId: otherRoom.id,
      title: 'Other room',
      organizerId: 'user-1',
      start: new Date(2026, 8, 1, 9, 0),
      end: new Date(2026, 8, 1, 10, 0),
      status: 'confirmed',
      attendees: 2,
      createdAt: new Date(2026, 8, 1, 7, 0),
    });
    const created = await service.create('user-2', cmd()); // same slot, other room
    expect(created.roomName).toBe('Hudson');
  });

  it('rejects_booking_over_capacity with a 422', async () => {
    await expectError(
      service.create('user-1', cmd({ attendees: 9 })), // Hudson holds 8
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
  });

  it('rejects_bookings_for_inactive_rooms with a 409', async () => {
    await rooms.update({ ...room, active: false });
    await expectError(
      service.create('user-1', cmd()),
      ERROR_CODES.ROOM_INACTIVE,
      409,
    );
  });

  it('rejects bookings for unknown rooms with a 404', async () => {
    await expectError(
      service.create('user-1', cmd({ roomId: 'missing' })),
      ERROR_CODES.NOT_FOUND,
      404,
    );
  });

  it('rejects unparseable timestamps with a 400 validation error', async () => {
    await expectError(
      service.create('user-1', cmd({ start: '2026-13-40T99:99', end: iso(1, 10) })),
      ERROR_CODES.VALIDATION,
      400,
    );
  });
});

describe('BookingService.cancel — enforces_cancellation_window', () => {
  it('lets the organizer cancel up to 1 hour before start', async () => {
    const seeded = await seedBooking({ start: new Date(2026, 8, 1, 12, 0) });
    now = new Date(2026, 8, 1, 10, 59); // 61 minutes before start
    const cancelled = await service.cancel('user-1', 'employee', seeded.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('allows cancelling exactly 1 hour before start (inclusive boundary)', async () => {
    const seeded = await seedBooking({ start: new Date(2026, 8, 1, 12, 0) });
    now = new Date(2026, 8, 1, 11, 0);
    const cancelled = await service.cancel('user-1', 'employee', seeded.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('rejects an organizer cancelling inside the 1-hour window with a 422', async () => {
    const seeded = await seedBooking({ start: new Date(2026, 8, 1, 12, 0) });
    now = new Date(2026, 8, 1, 11, 1);
    await expectError(
      service.cancel('user-1', 'employee', seeded.id),
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
  });

  it('allows an admin to cancel anytime, even after the start', async () => {
    const seeded = await seedBooking();
    now = new Date(2026, 8, 1, 13, 0); // after the booking ended
    const cancelled = await service.cancel('user-9', 'admin', seeded.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('forbids a non-organizer employee from cancelling with a 403', async () => {
    const seeded = await seedBooking();
    await expectError(
      service.cancel('user-2', 'employee', seeded.id),
      ERROR_CODES.FORBIDDEN,
      403,
    );
  });

  it('rejects cancelling an already-cancelled booking with a 422', async () => {
    const seeded = await seedBooking();
    await service.cancel('user-1', 'employee', seeded.id);
    await expectError(
      service.cancel('user-1', 'employee', seeded.id),
      ERROR_CODES.RULE_VIOLATION,
      422,
    );
  });

  it('rejects cancelling an unknown booking with a 404', async () => {
    await expectError(
      service.cancel('user-1', 'employee', 'missing'),
      ERROR_CODES.NOT_FOUND,
      404,
    );
  });

  it('keeps cancellations working for bookings on a deactivated room', async () => {
    const seeded = await seedBooking();
    await rooms.update({ ...room, active: false });
    const cancelled = await service.cancel('user-1', 'employee', seeded.id);
    expect(cancelled.status).toBe('cancelled');
  });
});

describe('BookingService.listMine — marks_completed_bookings', () => {
  it('shows bookings whose end has passed as completed without mutating stored status', async () => {
    await seedBooking();
    now = new Date(2026, 8, 1, 10, 30); // booking ended at 10:00
    const mine = await service.listMine('user-1');
    expect(mine).toHaveLength(1);
    expect(mine[0].status).toBe('completed');
    expect((await bookings.findById('seed-1'))?.status).toBe('confirmed'); // history untouched
  });

  it('shows future bookings as confirmed', async () => {
    await seedBooking();
    const mine = await service.listMine('user-1');
    expect(mine[0].status).toBe('confirmed');
  });

  it('keeps cancelled bookings cancelled after their end passes', async () => {
    const seeded = await seedBooking();
    await service.cancel('user-1', 'employee', seeded.id);
    now = new Date(2026, 8, 1, 10, 30);
    const mine = await service.listMine('user-1');
    expect(mine[0].status).toBe('cancelled');
  });

  it('returns an empty list for an organizer without bookings', async () => {
    expect(await service.listMine('nobody')).toEqual([]);
  });
});

describe('BookingService.availability', () => {
  it('returns the full free grid when the room has no bookings', async () => {
    const grid = await service.availability(room.id, '2026-09-01');
    expect(grid.roomId).toBe(room.id);
    expect(grid.slots).toHaveLength(11); // 08:00 → 19:00 hourly
    expect(grid.slots[0]).toMatchObject({ start: '08:00', end: '09:00', available: true });
    expect(grid.slots[10]).toMatchObject({ start: '18:00', end: '19:00', available: true });
    expect(grid.slots.every((slot) => slot.available)).toBe(true);
  });

  it('marks slots covered by a booking as busy and carries the booking info', async () => {
    const seeded = await seedBooking({
      start: new Date(2026, 8, 1, 9, 30),
      end: new Date(2026, 8, 1, 11, 0),
    });
    const grid = await service.availability(room.id, '2026-09-01');
    expect(grid.slots.find((s) => s.start === '08:00')?.available).toBe(true);
    expect(grid.slots.find((s) => s.start === '09:00')).toMatchObject({
      available: false,
      bookingId: seeded.id,
      title: 'Seeded booking',
    });
    expect(grid.slots.find((s) => s.start === '10:00')?.available).toBe(false);
    expect(grid.slots.find((s) => s.start === '11:00')?.available).toBe(true);
  });

  it('excludes cancelled bookings from the grid', async () => {
    const seeded = await seedBooking();
    await service.cancel('user-1', 'employee', seeded.id);
    const grid = await service.availability(room.id, '2026-09-01');
    expect(grid.slots.every((slot) => slot.available)).toBe(true);
  });

  it('rejects availability for an unknown room with a 404', async () => {
    await expectError(service.availability('missing', '2026-09-01'), ERROR_CODES.NOT_FOUND, 404);
  });
});
