import { describe, expect, it } from 'vitest';
import type { Booking, Room, User } from 'shared';
import { InMemoryBookingRepository } from './booking-repository.js';
import { InMemoryRoomRepository } from './room-repository.js';
import { InMemoryUserRepository } from './user-repository.js';

describe('InMemoryUserRepository', () => {
  it('finds by email case-insensitively', async () => {
    const repo = new InMemoryUserRepository();
    const user: User = {
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'salt:hash',
      role: 'employee',
      createdAt: '2026-08-29T10:00:00Z',
    };
    await repo.create(user);
    await expect(repo.findByEmail('ADA@EXAMPLE.COM')).resolves.toEqual(user);
    await expect(repo.findByEmail('nope@example.com')).resolves.toBeNull();
  });

  it('updates an existing user and rejects unknown ids on update', async () => {
    const repo = new InMemoryUserRepository();
    const user: User = {
      id: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      passwordHash: 'a:b',
      role: 'employee',
      createdAt: '2026-08-29T10:00:00Z',
    };
    await repo.create(user);
    await repo.update({ ...user, name: 'Ada L.' });
    await expect(repo.findById('u1')).resolves.toMatchObject({ name: 'Ada L.' });
  });
});

describe('InMemoryRoomRepository', () => {
  it('finds by display name case-insensitively', async () => {
    const repo = new InMemoryRoomRepository();
    const room: Room = {
      id: 'r1',
      name: 'Atlas',
      capacity: 10,
      floor: 3,
      features: ['videoconf'],
      active: true,
    };
    await repo.create(room);
    await expect(repo.findByDisplayName('  ATLAS ')).resolves.toEqual(room);
    await expect(repo.findByDisplayName('Orion')).resolves.toBeNull();
  });

  it('lists all rooms including inactive ones', async () => {
    const repo = new InMemoryRoomRepository();
    await repo.create({ id: 'r1', name: 'A', capacity: 4, floor: 1, features: [], active: true });
    await repo.create({ id: 'r2', name: 'B', capacity: 4, floor: 1, features: [], active: false });
    await expect(repo.listAll()).resolves.toHaveLength(2);
  });
});

describe('InMemoryBookingRepository', () => {
  const booking = (overrides: Partial<Booking> = {}): Booking => ({
    id: 'b1',
    roomId: 'r1',
    title: 'Standup',
    organizerId: 'u1',
    start: '2026-08-30T09:00:00Z',
    end: '2026-08-30T09:30:00Z',
    recurrence: { kind: 'none' },
    status: 'confirmed',
    attendees: 4,
    createdAt: '2026-08-29T10:00:00Z',
    ...overrides,
  });

  it('scopes lists by room and organizer', async () => {
    const repo = new InMemoryBookingRepository();
    await repo.create(booking({ id: 'b1', roomId: 'r1', organizerId: 'u1' }));
    await repo.create(booking({ id: 'b2', roomId: 'r2', organizerId: 'u1' }));
    await repo.create(booking({ id: 'b3', roomId: 'r1', organizerId: 'u2' }));
    await expect(repo.listForRoom('r1')).resolves.toHaveLength(2);
    await expect(repo.listByOrganizer('u1')).resolves.toHaveLength(2);
    await expect(repo.listAll()).resolves.toHaveLength(3);
  });

  it('updates a booking (e.g. cancellation)', async () => {
    const repo = new InMemoryBookingRepository();
    await repo.create(booking());
    await repo.update({ ...booking(), status: 'cancelled' });
    await expect(repo.findById('b1')).resolves.toMatchObject({ status: 'cancelled' });
  });
});
