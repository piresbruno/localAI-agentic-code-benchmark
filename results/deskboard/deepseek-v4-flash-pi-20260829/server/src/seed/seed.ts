/**
 * Default data: a handful of rooms and the admin account. Seeding is
 * idempotent (only when the store is empty) so restarts don't duplicate data.
 * The seeded admin password is changeable via PUT /api/users/me/password.
 */
import type { Room, User } from 'shared';
import { hashPassword } from '../auth/password.js';
import type { Clock, IdGen } from '../ports.js';
import type { RoomRepository } from '../repositories/room-repository.js';
import type { UserRepository } from '../repositories/user-repository.js';

export const SEEDED_ADMIN_EMAIL = 'admin@deskboard.local';
export const SEEDED_ADMIN_PASSWORD = 'admin123';

export interface SeedDeps {
  users: UserRepository;
  rooms: RoomRepository;
  clock: Clock;
  idGen: IdGen;
}

const DEFAULT_ROOMS: Array<Omit<Room, 'id' | 'active'>> = [
  { name: 'Atlas', capacity: 8, floor: 3, features: ['screen', 'videoconf'] },
  { name: 'Orion', capacity: 12, floor: 5, features: ['screen', 'whiteboard', 'videoconf'] },
  { name: 'Vega', capacity: 4, floor: 2, features: ['phone'] },
  { name: 'Polaris', capacity: 20, floor: 1, features: ['screen', 'videoconf', 'phone'] },
  { name: 'Andromeda', capacity: 6, floor: 4, features: ['whiteboard'] },
  { name: 'Lyra', capacity: 2, floor: 6, features: ['phone', 'videoconf'] },
];

export async function seed(deps: SeedDeps): Promise<void> {
  const now = deps.clock.now().toISOString();

  const existingUsers = await deps.users.list();
  if (existingUsers.length === 0) {
    const admin: User = {
      id: deps.idGen.next(),
      name: 'DeskBoard Admin',
      email: SEEDED_ADMIN_EMAIL,
      passwordHash: hashPassword(SEEDED_ADMIN_PASSWORD),
      role: 'admin',
      createdAt: now,
    };
    await deps.users.create(admin);
  }

  const existingRooms = await deps.rooms.listAll();
  if (existingRooms.length === 0) {
    for (const room of DEFAULT_ROOMS) {
      await deps.rooms.create({ ...room, id: deps.idGen.next(), active: true });
    }
  }
}
