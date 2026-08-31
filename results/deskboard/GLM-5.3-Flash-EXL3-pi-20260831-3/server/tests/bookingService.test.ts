import { describe, expect, it } from 'vitest';
import { BookingService } from '../src/services/bookingService.js';
import { RoomService } from '../src/services/roomService.js';
import type { Clock, IdGen } from '../src/services/clock.js';
import { MemoryRoomRepository } from '../src/repositories/memoryRooms.js';
import { MemoryBookingRepository } from '../src/repositories/memoryBookings.js';
import type { BookingCreateInput } from '@deskboard/shared';

/** Fixed "now": Tuesday 2026-09-01, 12:00 local — inside business hours. */
const NOW = new Date(2026, 8, 1, 12, 0, 0);
const fixedClock: Clock = { now: () => NOW };
const seqIdGen: IdGen = (() => {
  let n = 0;
  return { next: () => `id-${++n}` };
})();

function buildWorld() {
  const rooms = new MemoryRoomRepository();
  const bookings = new MemoryBookingRepository();
  const bookingService = new BookingService(bookings, rooms, fixedClock, seqIdGen);
  const roomService = new RoomService(rooms, seqIdGen);
  return { rooms, bookings, bookingService, roomService };
}

async function seedRoom(roomService: RoomService, over = {}) {
  return roomService.create({
    name: 'Board Room',
    capacity: 10,
    floor: 3,
    features: [],
    active: true,
    ...over,
  });
}

function bookingInput(over: Partial<BookingCreateInput> = {}): BookingCreateInput {
  return {
    roomId: 'unset',
    title: 'Sprint planning',
    start: '2026-09-01T13:00',
    end: '2026-09-01T14:00',
    attendees: 4,
    ...over,
  };
}

describe('BookingService', () => {
  it('creates a confirmed booking with room name and computed fields', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    const dto = await bookingService.create('u1', bookingInput({ roomId: room.id }));
    expect(dto.status).toBe('confirmed');
    expect(dto.roomName).toBe('Board Room');
    expect(dto.organizerId).toBe('u1');
    expect(dto.id).toBe('id-2'); // id-1 was the room
  });

  it('rejects_booking_outside_business_hours', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    const cases: Array<[string, string, string]> = [
      ['2026-09-06T10:00', '2026-09-06T11:00', 'weekend (Sunday)'],
      ['2026-09-01T07:00', '2026-09-01T08:00', 'starts before 08:00'],
      ['2026-09-01T18:00', '2026-09-01T19:30', 'ends after 19:00'],
      ['2026-09-01T13:00', '2026-09-01T13:00', 'end equal to start'],
      ['2026-09-01T13:00', '2026-09-01T12:00', 'end before start'],
      ['2026-09-01T09:00', '2026-09-01T13:01', 'longer than 4 hours'],
    ];
    for (const [start, end, why] of cases) {
      await expect(
        bookingService.create('u1', bookingInput({ roomId: room.id, start, end })),
        why,
      ).rejects.toMatchObject({ code: 'RULE_VIOLATION', status: 422 });
    }
  });

  it('allows the maximum 4-hour booking inside business hours', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    await expect(
      bookingService.create(
        'u1',
        bookingInput({ roomId: room.id, start: '2026-09-01T15:00', end: '2026-09-01T19:00' }),
      ),
    ).resolves.toMatchObject({ status: 'confirmed' });
  });

  it('rejects_booking_when_room_already_booked', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    await bookingService.create('u1', bookingInput({ roomId: room.id }));

    const overlaps: Array<[string, string, string]> = [
      ['2026-09-01T13:30', '2026-09-01T14:30', 'overlap tail'],
      ['2026-09-01T12:30', '2026-09-01T13:30', 'overlap head'],
      ['2026-09-01T12:00', '2026-09-01T15:00', 'encloses'],
      ['2026-09-01T13:15', '2026-09-01T13:45', 'contained'],
    ];
    for (const [start, end, why] of overlaps) {
      await expect(
        bookingService.create('u1', bookingInput({ roomId: room.id, start, end })),
        why,
      ).rejects.toMatchObject({ code: 'ROOM_CONFLICT', status: 409 });
    }
  });

  it('allows back-to-back adjacent bookings (touching, not overlapping)', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    await bookingService.create('u1', bookingInput({ roomId: room.id }));
    await expect(
      bookingService.create(
        'u2',
        bookingInput({ roomId: room.id, start: '2026-09-01T14:00', end: '2026-09-01T15:00' }),
      ),
    ).resolves.toMatchObject({ status: 'confirmed' });
  });

  it('ignores cancelled bookings when detecting conflicts', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    const booking = await bookingService.create('u1', bookingInput({ roomId: room.id }));
    await bookingService.cancel('u1', 'employee', booking.id);
    await expect(
      bookingService.create('u2', bookingInput({ roomId: room.id })),
    ).resolves.toMatchObject({ status: 'confirmed' });
  });

  it('rejects_booking_over_capacity', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService, { capacity: 6 });
    await expect(
      bookingService.create('u1', bookingInput({ roomId: room.id, attendees: 7 })),
    ).rejects.toMatchObject({ code: 'CAPACITY_EXCEEDED', status: 422 });
    await expect(
      bookingService.create('u1', bookingInput({ roomId: room.id, attendees: 6 })),
    ).resolves.toBeDefined();
  });

  it('rejects_bookings_for_inactive_rooms but keeps existing bookings and cancellations working', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    const booking = await bookingService.create('u1', bookingInput({ roomId: room.id }));
    await roomService.update(room.id, { active: false });

    await expect(
      bookingService.create(
        'u2',
        bookingInput({ roomId: room.id, start: '2026-09-01T16:00', end: '2026-09-01T17:00' }),
      ),
    ).rejects.toMatchObject({ code: 'ROOM_INACTIVE', status: 409 });

    // Existing booking still readable, and the organizer can still cancel it.
    await expect(bookingService.listMine('u1')).resolves.toHaveLength(1);
    await expect(bookingService.cancel('u1', 'employee', booking.id)).resolves.toMatchObject({
      status: 'cancelled',
    });
  });

  it('rejects bookings for unknown rooms with NOT_FOUND', async () => {
    const { bookingService } = buildWorld();
    await expect(
      bookingService.create('u1', bookingInput({ roomId: 'ghost' })),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  describe('enforces_cancellation_window', () => {
    it('lets the organizer cancel up to 1 hour before the start', async () => {
      const { bookingService, roomService } = buildWorld();
      const room = await seedRoom(roomService);
      // NOW is 12:00; start 14:00 is 2h away — inside the window.
      const booking = await bookingService.create(
        'u1',
        bookingInput({ roomId: room.id, start: '2026-09-01T14:00', end: '2026-09-01T15:00' }),
      );
      await expect(bookingService.cancel('u1', 'employee', booking.id)).resolves.toMatchObject({
        status: 'cancelled',
      });
    });

    it('stops the organizer once less than one hour remains', async () => {
      const { bookingService, roomService } = buildWorld();
      const room = await seedRoom(roomService);
      // NOW is 12:00; start 12:30 leaves only 30 minutes — window closed.
      const booking = await bookingService.create(
        'u1',
        bookingInput({ roomId: room.id, start: '2026-09-01T12:30', end: '2026-09-01T13:30' }),
      );
      await expect(bookingService.cancel('u1', 'employee', booking.id)).rejects.toMatchObject({
        code: 'CANCELLATION_WINDOW_CLOSED',
        status: 403,
      });
    });

    it('still allows the organizer at exactly one hour before the start', async () => {
      const { bookingService, roomService } = buildWorld();
      const room = await seedRoom(roomService);
      // NOW is 12:00; start 13:00 is exactly 1h away — window still open.
      const booking = await bookingService.create(
        'u1',
        bookingInput({ roomId: room.id, start: '2026-09-01T13:00', end: '2026-09-01T14:00' }),
      );
      await expect(bookingService.cancel('u1', 'employee', booking.id)).resolves.toMatchObject({
        status: 'cancelled',
      });
    });

    it('lets an admin cancel anytime', async () => {
      const { bookingService, roomService } = buildWorld();
      const room = await seedRoom(roomService);
      const booking = await bookingService.create(
        'u1',
        bookingInput({ roomId: room.id, start: '2026-09-01T13:00', end: '2026-09-01T14:00' }),
      );
      await expect(bookingService.cancel('admin-1', 'admin', booking.id)).resolves.toMatchObject({
        status: 'cancelled',
      });
    });

    it('never lets other employees cancel', async () => {
      const { bookingService, roomService } = buildWorld();
      const room = await seedRoom(roomService);
      const booking = await bookingService.create(
        'u1',
        bookingInput({ roomId: room.id, start: '2026-09-01T14:00', end: '2026-09-01T15:00' }),
      );
      await expect(bookingService.cancel('u2', 'employee', booking.id)).rejects.toMatchObject({
        code: 'CANCEL_FORBIDDEN',
        status: 403,
      });
    });

    it('reports unknown bookings as NOT_FOUND', async () => {
      const { bookingService } = buildWorld();
      await expect(bookingService.cancel('u1', 'admin', 'ghost')).rejects.toMatchObject({
        code: 'NOT_FOUND',
      });
    });
  });

  it('marks_completed_bookings on read without mutating history', async () => {
    const { bookingService, bookings, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    // NOW is 12:00; this booking ended at 11:00.
    const booking = await bookingService.create(
      'u1',
      bookingInput({ roomId: room.id, start: '2026-09-01T10:00', end: '2026-09-01T11:00' }),
    );
    const mine = await bookingService.listMine('u1');
    expect(mine[0]?.status).toBe('completed');

    // The stored record is untouched — completion is computed, not written.
    const stored = await bookings.findById(booking.id);
    expect(stored?.status).toBe('confirmed');
  });

  it('lists own bookings sorted by start time', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    await bookingService.create(
      'u1',
      bookingInput({ roomId: room.id, start: '2026-09-01T16:00', end: '2026-09-01T17:00' }),
    );
    await bookingService.create(
      'u1',
      bookingInput({ roomId: room.id, start: '2026-09-01T08:00', end: '2026-09-01T09:00' }),
    );
    const mine = await bookingService.listMine('u1');
    expect(mine.map((b) => b.start)).toEqual(['2026-09-01T08:00', '2026-09-01T16:00']);
  });

  it('builds a free/busy availability grid with hourly slots 08:00–19:00', async () => {
    const { bookingService, roomService } = buildWorld();
    const room = await seedRoom(roomService);
    await bookingService.create(
      'u1',
      bookingInput({ roomId: room.id, start: '2026-09-01T10:30', end: '2026-09-01T12:00' }),
    );

    const grid = await bookingService.availability(room.id, '2026-09-01');
    expect(grid.slots).toHaveLength(11); // 08:00 .. 18:00 hourly slots
    const busy = grid.slots.filter((s) => !s.available);
    expect(busy.map((s) => s.start)).toEqual(['10:00', '11:00']); // slots touching the booking
    expect(grid.slots[0]).toMatchObject({ start: '08:00', end: '09:00', available: true });
  });

  it('rejects availability for unknown rooms', async () => {
    const { bookingService } = buildWorld();
    await expect(bookingService.availability('ghost', '2026-09-01')).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });
});

describe('RoomService', () => {
  it('rejects_duplicate_room_name case-insensitively on create', async () => {
    const { roomService } = buildWorld();
    await seedRoom(roomService, { name: 'Board Room' });
    await expect(
      roomService.create({ name: '  board room ', capacity: 4, floor: 2, features: [] }),
    ).rejects.toMatchObject({ code: 'ROOM_NAME_TAKEN', status: 409 });
  });

  it('rejects duplicate names on update but allows keeping the same name', async () => {
    const { roomService } = buildWorld();
    await seedRoom(roomService, { name: 'Board Room' });
    const pod = await seedRoom(roomService, { name: 'Focus Pod', id: 'ignored' });
    await expect(roomService.update(pod.id, { name: 'BOARD ROOM' })).rejects.toMatchObject({
      code: 'ROOM_NAME_TAKEN',
    });
    await expect(roomService.update(pod.id, { name: 'Focus POD' })).resolves.toMatchObject({
      name: 'Focus POD',
    });
  });

  it('updates rooms partially', async () => {
    const { roomService } = buildWorld();
    const room = await seedRoom(roomService);
    const updated = await roomService.update(room.id, {
      capacity: 20,
      features: ['screen', 'phone'],
    });
    expect(updated).toMatchObject({
      capacity: 20,
      features: ['screen', 'phone'],
      name: 'Board Room',
    });
  });

  it('deactivates softly instead of deleting', async () => {
    const { roomService } = buildWorld();
    const room = await seedRoom(roomService);
    await roomService.deactivate(room.id);
    await expect(roomService.list()).resolves.toMatchObject([
      { active: false, name: 'Board Room' },
    ]);
  });

  it('throws NOT_FOUND for unknown rooms on update and deactivate', async () => {
    const { roomService } = buildWorld();
    await expect(roomService.update('ghost', { capacity: 5 })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    await expect(roomService.deactivate('ghost')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});
