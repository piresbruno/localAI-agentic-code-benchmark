// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
  InMemoryBookingRepository,
  InMemoryRoomRepository,
  InMemoryUserRepository
} from './index.js';
import type { Booking, Room, StoredUser } from 'deskboard-shared';

const NOW = '2026-09-07T09:00';
const booking = (over: Partial<Booking>): Booking => ({
  id: 'b-1',
  groupId: 'g-1',
  roomId: 'r-1',
  title: 'Session',
  organizerId: 'u-1',
  start: '2026-09-08T10:00',
  end: '2026-09-08T11:00',
  recurrence: { kind: 'none' },
  status: 'confirmed',
  attendees: 2,
  createdAt: NOW,
  ...over
});

describe('in-memory repositories', () => {
  it('findConfirmedOverlapping matches partial overlaps but not adjacency or cancelled', () => {
    const repo = new InMemoryBookingRepository();
    repo.create(booking({}));
    const overlap = (start: string, end: string) =>
      repo.findConfirmedOverlapping('r-1', start, end).map((b) => b.id);

    expect(overlap('2026-09-08T10:30', '2026-09-08T11:30')).toEqual(['b-1']);
    expect(overlap('2026-09-08T09:00', '2026-09-08T10:01')).toEqual(['b-1']);
    // Back-to-back: [09:00–10:00) does not overlap [10:00–11:00)
    expect(overlap('2026-09-08T09:00', '2026-09-08T10:00')).toEqual([]);
    expect(overlap('2026-09-08T11:00', '2026-09-08T12:00')).toEqual([]);
    // Other rooms are unaffected
    expect(repo.findConfirmedOverlapping('r-2', '2026-09-08T10:30', '2026-09-08T10:40')).toEqual([]);
    // Cancelled bookings do not conflict
    repo.create(booking({ id: 'b-2', groupId: 'g-2', status: 'cancelled', start: '2026-09-09T10:00', end: '2026-09-09T11:00' }));
    expect(overlap('2026-09-09T10:30', '2026-09-09T10:45')).toEqual([]);
  });

  it('list filters by room, organizer, date and range, sorted by start', () => {
    const repo = new InMemoryBookingRepository();
    repo.create(booking({ id: 'b-1', start: '2026-09-09T10:00' }));
    repo.create(booking({ id: 'b-2', start: '2026-09-08T10:00', organizerId: 'u-2' }));
    repo.create(booking({ id: 'b-3', start: '2026-09-08T14:00', roomId: 'r-2' }));

    expect(repo.list({}).map((b) => b.id)).toEqual(['b-2', 'b-3', 'b-1']);
    expect(repo.list({ organizerId: 'u-2' }).map((b) => b.id)).toEqual(['b-2']);
    expect(repo.list({ roomId: 'r-2' }).map((b) => b.id)).toEqual(['b-3']);
    expect(repo.list({ date: '2026-09-08' }).map((b) => b.id)).toEqual(['b-2', 'b-3']);
    expect(repo.list({ fromStart: '2026-09-08T11:00', toStart: '2026-09-09T23:59' }).map((b) => b.id)).toEqual(['b-3', 'b-1']);
  });

  it('setStatus returns null for unknown ids and updates known ones', () => {
    const repo = new InMemoryBookingRepository();
    repo.create(booking({}));
    expect(repo.setStatus('b-1', 'cancelled')!.status).toBe('cancelled');
    expect(repo.setStatus('nope', 'cancelled')).toBeNull();
  });

  it('user repository isolates stored records and updates password hashes', () => {
    const repo = new InMemoryUserRepository();
    const u: StoredUser = {
      id: 'u-1',
      name: 'Nina',
      email: 'nina@example.com',
      role: 'employee',
      passwordHash: 'hash1',
      createdAt: NOW
    };
    repo.create(u);
    u.passwordHash = 'mutated';
    expect(repo.findById('u-1')!.passwordHash).toBe('hash1');
    expect(repo.findByEmail('nina@EXAMPLE.com')!.id).toBe('u-1');
    expect(repo.findByEmail('other@example.com')).toBeNull();
    expect(repo.updatePasswordHash('u-1', 'hash2')!.passwordHash).toBe('hash2');
    expect(repo.updatePasswordHash('ghost', 'x')).toBeNull();
  });

  it('room repository ignores case on names and copies on read', () => {
    const repo = new InMemoryRoomRepository();
    const room: Room = {
      id: 'r-1',
      name: 'Kiwi',
      capacity: 6,
      floor: 2,
      features: ['screen'],
      active: true,
      createdAt: NOW
    };
    repo.create(room);
    room.features.push('phone');
    expect(repo.findById('r-1')!.features).toEqual(['screen']);
    expect(repo.findByNameIgnoreCase('KIWI')!.id).toBe('r-1');
    expect(repo.findByNameIgnoreCase('mango')).toBeNull();
    expect(repo.list().map((r) => r.name)).toEqual(['Kiwi']);
  });
});
