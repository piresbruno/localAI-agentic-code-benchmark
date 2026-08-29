/** Default seed data: one admin account and a set of rooms. Runs on every boot (idempotent). */
import type { Room, RoomFeature, User } from '@deskboard/shared';
import type { UserRepository, RoomRepository } from '../repositories/types.js';
import { hashPassword } from '../auth/passwords.js';
import type { Clock, IdGen } from '../services/clock.js';

export const SEED_ADMIN = {
  name: 'DeskBoard Admin',
  email: 'admin@deskboard.local',
  password: 'admin123',
};

const DEFAULT_ROOMS: Array<{ name: string; capacity: number; floor: number; features: RoomFeature[] }> = [
  { name: 'Huddle A', capacity: 4, floor: 2, features: ['whiteboard'] },
  { name: 'Huddle B', capacity: 4, floor: 2, features: ['screen'] },
  { name: 'Boardroom', capacity: 14, floor: 5, features: ['screen', 'videoconf', 'phone'] },
  { name: 'Sprint Room', capacity: 8, floor: 3, features: ['whiteboard', 'screen'] },
  { name: 'Focus Pod', capacity: 1, floor: 3, features: ['phone'] },
];

export function seedData(users: UserRepository, rooms: RoomRepository, clock: Clock, idGen: IdGen): void {
  if (!users.findByEmail(SEED_ADMIN.email)) {
    const admin: User = {
      id: idGen.next(),
      name: SEED_ADMIN.name,
      email: SEED_ADMIN.email,
      role: 'admin',
      createdAt: clock.now().toISOString(),
    };
    users.create(admin, hashPassword(SEED_ADMIN.password));
  }

  for (const spec of DEFAULT_ROOMS) {
    const exists = rooms.findByNameIgnoreCase(spec.name);
    if (exists) continue;
    const room: Room = {
      id: idGen.next(),
      name: spec.name,
      capacity: spec.capacity,
      floor: spec.floor,
      features: [...spec.features],
      active: true,
      createdAt: clock.now().toISOString(),
    };
    rooms.create(room);
  }
}
