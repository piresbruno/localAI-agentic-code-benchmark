// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import {
  InMemoryBookingRepository,
  InMemoryRoomRepository,
  type RoomRepository
} from '../repositories/index.js';
import { fixedClock, sequentialIdGen } from './clock.js';
import { RoomService } from './roomService.js';
import { AppError, type RoomInput } from 'deskboard-shared';

const NOW = '2026-09-07T09:00';
const admin = { id: 'u-admin', role: 'admin' as const };
const employee = { id: 'u-1', role: 'employee' as const };

const roomInput = (over: Partial<RoomInput> = {}): RoomInput => ({
  name: 'Kiwi',
  capacity: 6,
  floor: 2,
  features: ['screen'],
  ...over
});

interface Ctx {
  rooms: RoomRepository;
  service: RoomService;
  bookings: InMemoryBookingRepository;
}

const setup = (): Ctx => {
  const rooms = new InMemoryRoomRepository();
  const bookings = new InMemoryBookingRepository();
  const service = new RoomService({
    rooms,
    bookings,
    clock: fixedClock(NOW),
    ids: sequentialIdGen('r')
  });
  return { rooms, service, bookings };
};

describe('room rules', () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = setup();
  });

  it('admins_manage_rooms_only — employees cannot create/update/deactivate (403)', () => {
    const { service } = ctx;
    expect(() => service.create(employee, roomInput())).toThrowError(/admin/i);
    const room = service.create(admin, roomInput());
    expect(() => service.update(employee, room.id, { capacity: 8 })).toThrowError(/admin/i);
    expect(() => service.deactivate(employee, room.id)).toThrowError(/admin/i);
    // Admin actions succeed
    expect(service.update(admin, room.id, { capacity: 8 }).capacity).toBe(8);
    expect(service.deactivate(admin, room.id).active).toBe(false);
  });

  it('rejects_duplicate_room_name — case-insensitive uniqueness 409', () => {
    const { service } = ctx;
    service.create(admin, roomInput({ name: 'Kiwi' }));
    try {
      service.create(admin, roomInput({ name: 'kiwi' }));
      expect.unreachable('expected duplicate');
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe('DUPLICATE_ROOM_NAME');
      expect(e.httpStatus).toBe(409);
    }
    // Renaming another room onto an existing name is also rejected
    const second = service.create(admin, roomInput({ name: 'Falcon' }));
    expect(() => service.update(admin, second.id, { name: 'KIWI' })).toThrowError(
      /already exists/
    );
    // Renaming a room to its own name (case change) is allowed
    expect(service.update(admin, second.id, { name: 'falcon' }).name).toBe('falcon');
  });

  it('deactivation blocks new bookings but leaves existing ones listed', () => {
    const { service, bookings, rooms } = ctx;
    const room = service.create(admin, roomInput());
    bookings.create({
      id: 'b-1',
      groupId: 'g-1',
      roomId: room.id,
      title: 'Existing',
      organizerId: 'u-1',
      start: '2026-09-07T10:00',
      end: '2026-09-07T11:00',
      recurrence: { kind: 'none' },
      status: 'confirmed',
      attendees: 2,
      createdAt: NOW
    });
    service.deactivate(admin, room.id);
    expect(rooms.findById(room.id)!.active).toBe(false);
    // Existing booking still retrievable through the repo (booking creation is
    // blocked in BookingService, covered there).
    expect(bookings.findById('b-1')!.status).toBe('confirmed');
  });

  it('availability returns an 08:00–19:00 hourly grid with busy slots marked', () => {
    const { service, bookings } = ctx;
    const room = service.create(admin, roomInput());
    bookings.create({
      id: 'b-1',
      groupId: 'g-1',
      roomId: room.id,
      title: 'Standup',
      organizerId: 'u-1',
      start: '2026-09-07T09:00',
      end: '2026-09-07T10:30',
      recurrence: { kind: 'none' },
      status: 'confirmed',
      attendees: 2,
      createdAt: NOW
    });
    const grid = service.availability(room.id, '2026-09-07');
    expect(grid.slots).toHaveLength(11); // 08:00..18:00
    expect(grid.slots[0]).toMatchObject({ start: '08:00', end: '09:00', available: true });
    expect(grid.slots[1]).toMatchObject({ start: '09:00', available: false, bookingTitle: 'Standup' });
    expect(grid.slots[2]).toMatchObject({ start: '10:00', available: false });
    expect(grid.slots[3]).toMatchObject({ start: '11:00', available: true });
  });

  it('availability and lookups on unknown rooms 404', () => {
    const { service } = ctx;
    expect(() => service.getById('nope')).toThrowError(/not found/i);
    expect(() => service.availability('nope', '2026-09-07')).toThrowError(/not found/i);
  });
});
