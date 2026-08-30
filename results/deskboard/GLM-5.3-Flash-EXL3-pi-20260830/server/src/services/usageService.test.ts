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
import { UsageService } from './usageService.js';
import { hashPassword } from '../auth/password.js';
import { AppError, type Booking, type Room } from 'deskboard-shared';

const NOW = '2026-09-07T09:00';
const admin = { id: 'u-admin', role: 'admin' as const };

interface Ctx {
  rooms: RoomRepository;
  bookings: BookingRepository;
  users: UserRepository;
  service: UsageService;
  room: Room;
}

const setup = (): Ctx => {
  const rooms = new InMemoryRoomRepository();
  const bookings = new InMemoryBookingRepository();
  const users = new InMemoryUserRepository();
  users.create({
    id: 'u-admin',
    name: 'Ada Admin',
    email: 'ada@deskboard.local',
    role: 'admin',
    passwordHash: hashPassword('password123'),
    createdAt: NOW
  });
  users.create({
    id: 'u-1',
    name: 'Olive Organizer',
    email: 'olive@deskboard.local',
    role: 'employee',
    passwordHash: hashPassword('password123'),
    createdAt: NOW
  });
  users.create({
    id: 'u-2',
    name: 'Sam Second',
    email: 'sam@deskboard.local',
    role: 'employee',
    passwordHash: hashPassword('password123'),
    createdAt: NOW
  });
  const room = rooms.create({
    id: 'r-1',
    name: 'Kiwi',
    capacity: 6,
    floor: 2,
    features: [],
    active: true,
    createdAt: NOW
  });
  return { rooms, bookings, users, service: new UsageService({ rooms, bookings, users }), room };
};

const booking = (over: Partial<Booking>): Booking => ({
  id: 'b-x',
  groupId: 'g-x',
  roomId: 'r-1',
  title: 'Session',
  organizerId: 'u-1',
  start: '2026-09-08T10:00',
  end: '2026-09-08T12:00',
  recurrence: { kind: 'none' },
  status: 'confirmed',
  attendees: 2,
  createdAt: NOW,
  ...over
});

describe('usage report', () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = setup();
  });

  it('sums booked hours, counts bookings and finds the top organizer per room', () => {
    const { service, bookings } = ctx;
    bookings.create(booking({ id: 'b-1', groupId: 'g-1', organizerId: 'u-1', start: '2026-09-08T09:00', end: '2026-09-08T11:00' }));
    bookings.create(booking({ id: 'b-2', groupId: 'g-2', organizerId: 'u-2', start: '2026-09-09T09:00', end: '2026-09-09T12:00' }));
    bookings.create(booking({ id: 'b-3', groupId: 'g-3', organizerId: 'u-2', start: '2026-09-10T09:00', end: '2026-09-10T10:00' }));

    const report = service.report(admin, '2026-09-08', '2026-09-10');
    expect(report.rooms).toHaveLength(1);
    const kiwi = report.rooms[0];
    expect(kiwi.totalHours).toBe(6);
    expect(kiwi.bookingCount).toBe(3);
    expect(kiwi.topOrganizer).toEqual({ name: 'Sam Second', hours: 4 });
  });

  it('excludes cancelled bookings and bookings outside the range', () => {
    const { service, bookings } = ctx;
    bookings.create(booking({ id: 'b-1', status: 'cancelled' }));
    bookings.create(booking({ id: 'b-2', start: '2026-10-01T09:00', end: '2026-10-01T10:00' }));
    const report = service.report(admin, '2026-09-08', '2026-09-10');
    expect(report.rooms[0].bookingCount).toBe(0);
    expect(report.rooms[0].totalHours).toBe(0);
    expect(report.rooms[0].topOrganizer).toBeNull();
  });

  it('rejects non-admin callers with 403', () => {
    const { service } = ctx;
    try {
      service.report({ id: 'u-1', role: 'employee' }, '2026-09-08', '2026-09-10');
      expect.unreachable();
    } catch (err) {
      expect((err as AppError).code).toBe('FORBIDDEN');
    }
  });
});
