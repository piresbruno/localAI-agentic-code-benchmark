import { describe, expect, it } from 'vitest';
import { MemoryUserRepository } from '../src/repositories/memoryUsers.js';
import { MemoryRoomRepository } from '../src/repositories/memoryRooms.js';
import { MemoryBookingRepository } from '../src/repositories/memoryBookings.js';
import type { StoredUser } from '../src/repositories/userRepository.js';
import type { Booking, Room } from '@deskboard/shared';

const user = (over: Partial<StoredUser> = {}): StoredUser => ({
  id: 'u1',
  name: 'Ana',
  email: 'ana@office.local',
  role: 'employee',
  passwordHash: 'scrypt:salt:hash',
  ...over,
});

const room = (over: Partial<Room> = {}): Room => ({
  id: 'r1',
  name: 'Board Room',
  capacity: 10,
  floor: 3,
  features: ['screen'],
  active: true,
  ...over,
});

const booking = (over: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  roomId: 'r1',
  title: 'Standup',
  organizerId: 'u1',
  start: '2026-09-01T09:00',
  end: '2026-09-01T10:00',
  status: 'confirmed',
  attendees: 4,
  createdAt: '2026-08-31T14:00',
  ...over,
});

describe('MemoryUserRepository', () => {
  it('round-trips a user by id and by email', async () => {
    const repo = new MemoryUserRepository();
    await repo.create(user());
    await expect(repo.findById('u1')).resolves.toMatchObject({ name: 'Ana' });
    await expect(repo.findByEmail('ana@office.local')).resolves.toMatchObject({ id: 'u1' });
  });

  it('looks emails up case-insensitively', async () => {
    const repo = new MemoryUserRepository();
    await repo.create(user());
    await expect(repo.findByEmail('ANA@OFFICE.LOCAL')).resolves.toMatchObject({ id: 'u1' });
  });

  it('returns null for unknown users', async () => {
    const repo = new MemoryUserRepository();
    await expect(repo.findById('nope')).resolves.toBeNull();
    await expect(repo.findByEmail('nope@office.local')).resolves.toBeNull();
  });
});

describe('MemoryRoomRepository', () => {
  it('finds rooms case-insensitively by name', async () => {
    const repo = new MemoryRoomRepository();
    await repo.create(room());
    await expect(repo.findByName('  BOARD ROOM ')).resolves.toMatchObject({ id: 'r1' });
  });

  it('returns null when no room matches the name', async () => {
    const repo = new MemoryRoomRepository();
    await repo.create(room());
    await expect(repo.findByName('Other Room')).resolves.toBeNull();
  });

  it('lists, updates, and reflects changes', async () => {
    const repo = new MemoryRoomRepository();
    await repo.create(room({ id: 'r1' }));
    await repo.create(room({ id: 'r2', name: 'Focus Pod' }));
    expect((await repo.list()).length).toBe(2);
    await repo.update(room({ id: 'r1', active: false }));
    await expect(repo.findById('r1')).resolves.toMatchObject({ active: false });
  });
});

describe('MemoryBookingRepository', () => {
  it('lists bookings for a room sorted by start time', async () => {
    const repo = new MemoryBookingRepository();
    await repo.create(booking({ id: 'b1', start: '2026-09-01T11:00' }));
    await repo.create(booking({ id: 'b2', start: '2026-09-01T09:00' }));
    const list = await repo.listByRoom('r1');
    expect(list.map((b) => b.id)).toEqual(['b2', 'b1']);
  });

  it('filters by date prefix when a date is given', async () => {
    const repo = new MemoryBookingRepository();
    await repo.create(booking({ id: 'b1', start: '2026-09-01T09:00' }));
    await repo.create(booking({ id: 'b2', start: '2026-09-02T09:00' }));
    const list = await repo.listByRoom('r1', '2026-09-01');
    expect(list.map((b) => b.id)).toEqual(['b1']);
  });

  it('lists bookings by organizer', async () => {
    const repo = new MemoryBookingRepository();
    await repo.create(booking({ id: 'b1', organizerId: 'u1' }));
    await repo.create(booking({ id: 'b2', organizerId: 'u2' }));
    expect((await repo.listByOrganizer('u1')).map((b) => b.id)).toEqual(['b1']);
  });

  it('updates status without losing the rest of the booking', async () => {
    const repo = new MemoryBookingRepository();
    await repo.create(booking());
    await repo.update(booking({ status: 'cancelled' }));
    await expect(repo.findById('b1')).resolves.toMatchObject({
      status: 'cancelled',
      title: 'Standup',
    });
  });
});
