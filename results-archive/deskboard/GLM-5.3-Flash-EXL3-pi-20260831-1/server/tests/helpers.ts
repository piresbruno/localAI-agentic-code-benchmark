import type { Clock, IdGen } from '../src/services/clock';
import { AuthService } from '../src/services/auth.service';
import { RoomService } from '../src/services/room.service';
import { BookingService } from '../src/services/booking.service';
import { AvailabilityService } from '../src/services/availability.service';
import { hashPassword } from '../src/auth/password';
import {
  MemoryBookingRepository,
  MemoryRoomRepository,
  MemoryUserRepository,
} from '../src/repositories/memory';
import type { AuthUser } from '../src/auth/jwt';
import type { UserEntity } from '../src/repositories/types';

/** Fixture date: a Wednesday. */
export const WED = '2026-09-02';
/** Fixture date: a Saturday. */
export const SAT = '2026-09-05';
/** Fixture "now": Wednesday 10:00 local. */
export const TEN_AM = new Date('2026-09-02T10:00:00');

export interface Ctx {
  clock: Clock;
  ids: IdGen;
  auth: AuthService;
  roomSvc: RoomService;
  bookingSvc: BookingService;
  availSvc: AvailabilityService;
  bookings: MemoryBookingRepository;
  admin: AuthUser;
  employee: AuthUser;
  otherEmployee: AuthUser;
  roomId: string;
  smallRoomId: string;
}

/** Fresh repositories + services with deterministic clock/ids for every test. */
export function makeCtx(now: Date = TEN_AM): Ctx {
  let seq = 0;
  const clock: Clock = { now: () => now };
  const ids: IdGen = { next: () => `id-${++seq}` };
  const users = new MemoryUserRepository();
  const rooms = new MemoryRoomRepository();
  const bookings = new MemoryBookingRepository();

  const mkUser = (id: string, name: string, role: UserEntity['role']): UserEntity => ({
    id,
    name,
    email: `${id}@test.local`,
    role,
    passwordHash: hashPassword('password-123'),
    createdAt: clock.now().toISOString(),
  });
  users.create(mkUser('admin-1', 'Admin', 'admin'));
  users.create(mkUser('emp-1', 'Emma Employee', 'employee'));
  users.create(mkUser('emp-2', 'Oscar Other', 'employee'));

  const roomSvc = new RoomService(rooms, ids);
  const roomId = rooms.create({
    id: 'room-1',
    name: 'Fjord',
    capacity: 8,
    floor: 3,
    features: ['screen', 'videoconf'],
    active: true,
  }).id;
  const smallRoomId = rooms.create({
    id: 'room-2',
    name: 'Pod',
    capacity: 2,
    floor: 1,
    features: ['phone'],
    active: true,
  }).id;

  return {
    clock,
    ids,
    auth: new AuthService(users, clock, ids, 'test-secret'),
    roomSvc,
    bookingSvc: new BookingService(bookings, rooms, users, clock, ids),
    availSvc: new AvailabilityService(rooms, bookings),
    bookings,
    admin: { sub: 'admin-1', role: 'admin', name: 'Admin' },
    employee: { sub: 'emp-1', role: 'employee', name: 'Emma Employee' },
    otherEmployee: { sub: 'emp-2', role: 'employee', name: 'Oscar Other' },
    roomId,
    smallRoomId,
  };
}
