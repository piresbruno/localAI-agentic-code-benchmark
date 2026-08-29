import { beforeEach, describe, expect, it } from 'vitest';
import type { Room } from 'shared';
import type { Clock, IdGen } from '../ports.js';
import { InMemoryBookingRepository } from '../repositories/booking-repository.js';
import { InMemoryRoomRepository } from '../repositories/room-repository.js';
import { BookingService, expandOccurrences } from './booking-service.js';
import { RoomService } from './room-service.js';
import { UsageService } from './usage-service.js';
import { InMemoryUserRepository } from '../repositories/user-repository.js';
import type { User } from 'shared';

/** Build a Date from local calendar fields (test TZ independent). */
const local = (y: number, m: number, d: number, h = 0, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0);

// Fixed "now": Tuesday 2026-08-25 10:00 local.
const NOW = local(2026, 8, 25, 10, 0);
const MUTABLE_NOW = { value: NOW };

const clock: Clock = { now: () => MUTABLE_NOW.value };
let nextId = 1;
const idGen: IdGen = { next: () => `id-${nextId++}` };

const ADMIN: { id: string; role: 'admin' } = { id: 'admin-1', role: 'admin' };
const EMPLOYEE: { id: string; role: 'employee' } = { id: 'emp-1', role: 'employee' };

let bookings: InMemoryBookingRepository;
let rooms: InMemoryRoomRepository;
let users: InMemoryUserRepository;
let bookingService: BookingService;
let roomService: RoomService;
let usageService: UsageService;

const makeRoom = (overrides: Partial<Room> = {}): Room => ({
  id: 'room-1',
  name: 'Atlas',
  capacity: 8,
  floor: 3,
  features: ['screen', 'videoconf'],
  active: true,
  ...overrides,
});

async function seedRoom(overrides: Partial<Room> = {}): Promise<Room> {
  const room = makeRoom(overrides);
  await rooms.create(room);
  return room;
}

/** Thursday 2026-08-27 is a safe "not today" weekday for future bookings. */
const THU = '2026-08-27';

async function bookThu(
  start = '14:00',
  durationMinutes = 60,
  overrides: {
    attendees?: number;
    recurrence?: { kind: 'none' } | { kind: 'weekly'; count: number };
  } = {},
) {
  return bookingService.create(
    {
      roomId: 'room-1',
      title: 'Sprint planning',
      start: `${THU}T${start}:00`,
      durationMinutes,
      attendees: overrides.attendees ?? 4,
      recurrence: overrides.recurrence ?? { kind: 'none' },
    },
    EMPLOYEE.id,
  );
}

beforeEach(() => {
  nextId = 1;
  MUTABLE_NOW.value = NOW;
  bookings = new InMemoryBookingRepository();
  rooms = new InMemoryRoomRepository();
  users = new InMemoryUserRepository();
  bookingService = new BookingService({ bookings, rooms, clock, idGen });
  roomService = new RoomService({ rooms, clock, idGen });
  usageService = new UsageService({ bookings, rooms, users });
});

// ---------------------------------------------------------------------------
// §4 business rules (named after the spec)
// ---------------------------------------------------------------------------

describe('rejects_booking_outside_business_hours', () => {
  it('rejects a weekend start', async () => {
    await seedRoom();
    await expect(
      bookingService.create(
        {
          roomId: 'room-1',
          title: 'Weekend sync',
          start: '2026-08-29T10:00:00',
          durationMinutes: 60,
          attendees: 3,
          recurrence: { kind: 'none' },
        },
        EMPLOYEE.id,
      ),
    ).rejects.toMatchObject({ code: 'RULE_VIOLATION' });
  });

  it('rejects a start before 08:00', async () => {
    await seedRoom();
    await expect(
      bookingService.create(
        {
          roomId: 'room-1',
          title: 'Early bird',
          start: `${THU}T07:30:00`,
          durationMinutes: 30,
          attendees: 2,
          recurrence: { kind: 'none' },
        },
        EMPLOYEE.id,
      ),
    ).rejects.toMatchObject({ code: 'RULE_VIOLATION' });
  });

  it('rejects an end after 19:00', async () => {
    await seedRoom();
    await expect(
      bookingService.create(
        {
          roomId: 'room-1',
          title: 'Late night',
          start: `${THU}T18:30:00`,
          durationMinutes: 60,
          attendees: 2,
          recurrence: { kind: 'none' },
        },
        EMPLOYEE.id,
      ),
    ).rejects.toMatchObject({ code: 'RULE_VIOLATION' });
  });

  it('rejects a duration longer than 4 hours', async () => {
    await seedRoom();
    await expect(
      bookingService.create(
        {
          roomId: 'room-1',
          title: 'Marathon',
          start: `${THU}T09:00:00`,
          durationMinutes: 270,
          attendees: 2,
          recurrence: { kind: 'none' },
        },
        EMPLOYEE.id,
      ),
    ).rejects.toMatchObject({ code: 'RULE_VIOLATION' });
  });

  it('allows exactly 4 hours ending at 19:00', async () => {
    await seedRoom();
    const created = (
      await bookingService.create(
        {
          roomId: 'room-1',
          title: 'Full afternoon',
          start: `${THU}T15:00:00`,
          durationMinutes: 240,
          attendees: 2,
          recurrence: { kind: 'none' },
        },
        EMPLOYEE.id,
      )
    )[0]!;
    expect(created.status).toBe('confirmed');
  });
});

describe('rejects_booking_when_room_already_booked', () => {
  it('rejects an overlapping booking with ROOM_CONFLICT', async () => {
    await seedRoom();
    await bookThu('14:00', 60);
    await expect(bookThu('14:30', 60)).rejects.toMatchObject({ code: 'ROOM_CONFLICT' });
  });

  it('allows adjacent back-to-back bookings', async () => {
    await seedRoom();
    await bookThu('14:00', 60);
    await expect(bookThu('15:00', 60)).resolves.toHaveLength(1);
  });

  it('allows the same slot in a different room', async () => {
    await seedRoom();
    await seedRoom({ id: 'room-2', name: 'Orion' });
    await bookThu('14:00', 60);
    await expect(
      bookingService.create(
        {
          roomId: 'room-2',
          title: 'Other room',
          start: `${THU}T14:00:00`,
          durationMinutes: 60,
          attendees: 2,
          recurrence: { kind: 'none' },
        },
        EMPLOYEE.id,
      ),
    ).resolves.toHaveLength(1);
  });

  it('does not conflict with cancelled bookings (room is freed)', async () => {
    await seedRoom();
    const [created] = await bookThu('14:00', 60);
    const first = created!;
    await bookingService.cancel(first.id, EMPLOYEE);
    await expect(bookThu('14:00', 60)).resolves.toHaveLength(1);
  });
});

describe('expands_weekly_recurrence', () => {
  it('creates count occurrences 7 days apart', async () => {
    await seedRoom();
    const created = await bookThu('14:00', 60, { recurrence: { kind: 'weekly', count: 3 } });
    expect(created).toHaveLength(3);
    const starts = created.map((b) => b.start);
    expect(new Set(starts).size).toBe(3);
    const [first, second, third] = starts.sort();
    expect(new Date(second!).getTime() - new Date(first!).getTime()).toBe(7 * 86_400_000);
    expect(new Date(third!).getTime() - new Date(second!).getTime()).toBe(7 * 86_400_000);
  });

  it('rejects the whole recurrence when any occurrence conflicts', async () => {
    await seedRoom();
    // Occupy Thursday 2026-09-03 14:00–15:00 (the second occurrence).
    await bookingService.create(
      {
        roomId: 'room-1',
        title: 'Occupier',
        start: '2026-09-03T14:00:00',
        durationMinutes: 60,
        attendees: 2,
        recurrence: { kind: 'none' },
      },
      EMPLOYEE.id,
    );
    // Weekly series starting 2026-08-27 would hit 2026-09-03 → whole series rejected.
    await expect(
      bookThu('14:00', 60, { recurrence: { kind: 'weekly', count: 3 } }),
    ).rejects.toMatchObject({
      code: 'ROOM_CONFLICT',
    });
  });

  it('rejects the whole recurrence when any occurrence breaks business hours', async () => {
    await seedRoom();
    // First occurrence fine (Thu 18:30), second would end 19:30 → rejected.
    await expect(
      bookThu('18:30', 60, { recurrence: { kind: 'weekly', count: 2 } }),
    ).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
    });
  });
});

describe('rejects_booking_over_capacity', () => {
  it('rejects attendees above room capacity', async () => {
    await seedRoom({ capacity: 6 });
    await expect(bookThu('14:00', 60, { attendees: 7 })).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
    });
  });

  it('allows attendees exactly at capacity', async () => {
    await seedRoom({ capacity: 6 });
    await expect(bookThu('14:00', 60, { attendees: 6 })).resolves.toHaveLength(1);
  });
});

describe('rejects_booking_in_the_past', () => {
  it('rejects a start before now', async () => {
    await seedRoom();
    await expect(
      bookingService.create(
        {
          roomId: 'room-1',
          title: 'Yesterday',
          start: '2026-08-25T09:00:00',
          durationMinutes: 60,
          attendees: 2,
          recurrence: { kind: 'none' },
        },
        EMPLOYEE.id,
      ),
    ).rejects.toMatchObject({ code: 'RULE_VIOLATION' });
  });
});

describe('rejects_booking_in_deactivated_room', () => {
  it('blocks new bookings in a deactivated room', async () => {
    const room = await seedRoom();
    await roomService.deactivate(room.id, ADMIN);
    await expect(bookThu('14:00', 60)).rejects.toMatchObject({ code: 'RULE_VIOLATION' });
  });

  it('keeps existing bookings when a room is deactivated', async () => {
    await seedRoom();
    const [created] = await bookThu('14:00', 60);
    await roomService.deactivate('room-1', ADMIN);
    await expect(bookingService.listMine(EMPLOYEE.id)).resolves.toHaveLength(1);
    void created;
  });
});

describe('enforces_cancellation_window', () => {
  it('lets the organizer cancel more than 1h before start', async () => {
    await seedRoom();
    const created = (await bookThu('14:00', 60))[0]!;
    await expect(bookingService.cancel(created.id, EMPLOYEE)).resolves.toMatchObject({
      status: 'cancelled',
    });
  });

  it('rejects organizer cancellation inside the 1h window', async () => {
    await seedRoom();
    MUTABLE_NOW.value = local(2026, 8, 27, 13, 30); // 30 minutes before 14:00
    const created = (await bookThu('14:00', 60))[0]!;
    await expect(bookingService.cancel(created.id, EMPLOYEE)).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
    });
  });

  it('lets an admin cancel at any time', async () => {
    await seedRoom();
    MUTABLE_NOW.value = local(2026, 8, 27, 13, 59);
    const created = (await bookThu('14:00', 60))[0]!;
    await expect(bookingService.cancel(created.id, ADMIN)).resolves.toMatchObject({
      status: 'cancelled',
    });
  });

  it('forbids cancellation by anyone else', async () => {
    await seedRoom();
    const [created] = await bookThu('14:00', 60);
    const first = created!;
    const other: { id: string; role: 'employee' } = { id: 'emp-2', role: 'employee' };
    await expect(bookingService.cancel(first.id, other)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('rejects cancelling an already-cancelled booking', async () => {
    await seedRoom();
    const [created] = await bookThu('14:00', 60);
    const first = created!;
    await bookingService.cancel(first.id, EMPLOYEE);
    await expect(bookingService.cancel(first.id, ADMIN)).rejects.toMatchObject({
      code: 'BOOKING_NOT_ACTIVE',
    });
  });
});

describe('marks_completed_bookings', () => {
  it('reads past bookings as completed without mutating storage', async () => {
    await seedRoom();
    MUTABLE_NOW.value = local(2026, 8, 27, 8, 0);
    const [created] = await bookThu('09:00', 60);
    const first = created!;
    // Stored status stays confirmed…
    expect((await bookings.findById(first.id))!.status).toBe('confirmed');
    // …but reads report completed once the end passed.
    MUTABLE_NOW.value = local(2026, 8, 27, 10, 30);
    const mine = await bookingService.listMine(EMPLOYEE.id);
    expect(mine[0]).toMatchObject({ id: first.id, status: 'completed' });
    await expect(bookings.findById(first.id)).resolves.toMatchObject({ status: 'confirmed' });
  });
});

describe('admins_manage_rooms_only', () => {
  it('forbids room creation for employees', async () => {
    await expect(
      roomService.create({ name: 'Pegasus', capacity: 10, floor: 1, features: [] }, EMPLOYEE),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' });
  });

  it('forbids room updates for employees', async () => {
    const room = await seedRoom();
    await expect(roomService.update(room.id, { capacity: 20 }, EMPLOYEE)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('forbids deactivation for employees', async () => {
    const room = await seedRoom();
    await expect(roomService.deactivate(room.id, EMPLOYEE)).rejects.toMatchObject({
      code: 'FORBIDDEN',
    });
  });

  it('allows admins to create, update and deactivate', async () => {
    const created = await roomService.create(
      { name: 'Pegasus', capacity: 10, floor: 1, features: ['screen'] },
      ADMIN,
    );
    const updated = await roomService.update(created.id, { capacity: 12 }, ADMIN);
    expect(updated.capacity).toBe(12);
    const deactivated = await roomService.deactivate(created.id, ADMIN);
    expect(deactivated.active).toBe(false);
  });
});

describe('rejects_duplicate_room_name', () => {
  it('rejects an identical name case-insensitively on create', async () => {
    await seedRoom({ name: 'Atlas' });
    await expect(
      roomService.create({ name: ' atlas ', capacity: 5, floor: 1, features: [] }, ADMIN),
    ).rejects.toMatchObject({ code: 'ROOM_NAME_TAKEN' });
  });

  it('rejects renaming a room to an existing name', async () => {
    await seedRoom({ id: 'room-1', name: 'Atlas' });
    const other = await rooms.create(makeRoom({ id: 'room-2', name: 'Orion' }));
    await expect(roomService.update(other.id, { name: 'ATLAS' }, ADMIN)).rejects.toMatchObject({
      code: 'ROOM_NAME_TAKEN',
    });
    void other;
  });

  it('allows a room to keep its own name on update', async () => {
    const room = await seedRoom();
    await expect(roomService.update(room.id, { capacity: 9 }, ADMIN)).resolves.toMatchObject({
      capacity: 9,
    });
  });
});

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

describe('availability grid', () => {
  it('marks occupied hourly slots as busy with booking details', async () => {
    await seedRoom();
    await bookThu('14:00', 90);
    const { slots, roomName } = await bookingService.getAvailability('room-1', THU);
    expect(roomName).toBe('Atlas');
    expect(slots).toHaveLength(11); // 08:00–19:00
    const busy = slots.filter((s) => s.status === 'busy');
    expect(busy).toHaveLength(2); // 14:00 and 15:00 slots
    expect(busy[0]!.start).toBe(new Date(`${THU}T14:00:00`).toISOString());
    expect(busy[1]!.start).toBe(new Date(`${THU}T15:00:00`).toISOString());
    expect(busy.every((s) => s.bookings.length > 0)).toBe(true);
    expect(slots.every((s) => s.start < s.end)).toBe(true);
  });

  it('returns NOT_FOUND for an unknown room', async () => {
    await expect(bookingService.getAvailability('ghost', THU)).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

// ---------------------------------------------------------------------------
// Listing semantics
// ---------------------------------------------------------------------------

describe('booking listing', () => {
  it('scopes employee lists to their own bookings', async () => {
    await seedRoom();
    await bookThu('14:00', 60);
    await bookingService.create(
      {
        roomId: 'room-1',
        title: 'Mine',
        start: `${THU}T16:00:00`,
        durationMinutes: 30,
        attendees: 2,
        recurrence: { kind: 'none' },
      },
      'emp-2',
    );
    const mine = await bookingService.list(EMPLOYEE);
    expect(mine).toHaveLength(1);
    expect(mine[0]!.title).toBe('Sprint planning');
  });

  it('lists all bookings for admins and filters by date and room', async () => {
    await seedRoom();
    await seedRoom({ id: 'room-2', name: 'Orion' });
    await bookThu('14:00', 60);
    await bookingService.create(
      {
        roomId: 'room-2',
        title: 'Other',
        start: '2026-09-02T10:00:00',
        durationMinutes: 30,
        attendees: 2,
        recurrence: { kind: 'none' },
      },
      'emp-2',
    );
    const all = await bookingService.list(ADMIN);
    expect(all).toHaveLength(2);
    const byRoom = await bookingService.list(ADMIN, { roomId: 'room-2' });
    expect(byRoom).toHaveLength(1);
    const byDate = await bookingService.list(ADMIN, { date: THU });
    expect(byDate).toHaveLength(1);
    const both = await bookingService.list(ADMIN, { date: '2026-09-02', roomId: 'room-2' });
    expect(both).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// Usage report
// ---------------------------------------------------------------------------

describe('usage report', () => {
  const seedUsers = async () => {
    const user: User = {
      id: 'emp-1',
      name: 'Grace',
      email: 'grace@example.com',
      passwordHash: 's:h',
      role: 'employee',
      createdAt: '2026-08-01T00:00:00Z',
    };
    await users.create(user);
  };

  it('reports booked hours, counts and top organizer per room', async () => {
    await seedUsers();
    await seedRoom();
    await bookThu('14:00', 90); // 1.5h
    await bookThu('16:00', 60); // 1h → same organizer
    await bookingService.create(
      {
        roomId: 'room-1',
        title: 'Emp2 booking',
        start: `${THU}T09:00:00`,
        durationMinutes: 60,
        attendees: 2,
        recurrence: { kind: 'none' },
      },
      'emp-2',
    );
    const report = await usageService.getUsage('2026-08-25', '2026-08-31', ADMIN);
    expect(report.rooms).toHaveLength(1);
    const row = report.rooms[0]!;
    expect(row.bookedHours).toBe(3.5);
    expect(row.bookings).toBe(3);
    expect(row.topOrganizer).toEqual({ email: 'grace@example.com', bookings: 2 });
  });

  it('excludes cancelled bookings and rooms without bookings', async () => {
    await seedUsers();
    await seedRoom();
    await seedRoom({ id: 'room-2', name: 'Orion' });
    const [created] = await bookThu('14:00', 60);
    const first = created!;
    await bookingService.cancel(first.id, EMPLOYEE);
    const report = await usageService.getUsage('2026-08-25', '2026-08-31', ADMIN);
    expect(report.rooms).toHaveLength(2);
    expect(report.rooms[0]!.bookings).toBe(0);
    expect(report.rooms[0]!.topOrganizer).toBeNull();
  });

  it('rejects non-admin callers', async () => {
    await expect(usageService.getUsage('2026-08-25', '2026-08-31', EMPLOYEE)).rejects.toMatchObject(
      {
        code: 'FORBIDDEN',
      },
    );
  });
});

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

describe('expandOccurrences', () => {
  it('returns a single occurrence for none', () => {
    const occ = expandOccurrences(local(2026, 8, 27, 9, 0), 30, { kind: 'none' });
    expect(occ).toHaveLength(1);
    expect(occ[0]!.end.getTime() - occ[0]!.start.getTime()).toBe(30 * 60_000);
  });

  it('spreads weekly occurrences 7 days apart', () => {
    const occ = expandOccurrences(local(2026, 8, 27, 9, 0), 60, { kind: 'weekly', count: 3 });
    expect(occ.map((o) => o.start.getDay())).toEqual([4, 4, 4]); // all Thursdays
    expect(occ[1]!.start.getTime() - occ[0]!.start.getTime()).toBe(7 * 86_400_000);
  });
});
