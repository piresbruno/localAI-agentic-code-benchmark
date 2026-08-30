/**
 * Seeds default data on boot: the admin account (spec §4) and a few rooms.
 * Idempotent — re-running never duplicates.
 */
import type { RoomRepository, UserRepository } from '../repositories/types.js';
import type { IdGen } from '../services/clock.js';
import { hashPassword } from '../auth/password.js';
import type { RoomFeature } from 'deskboard-shared';

export interface SeedOptions {
  adminEmail: string;
  adminPassword: string;
  rooms: { name: string; capacity: number; floor: number; features: RoomFeature[] }[];
}

export const DEFAULT_SEED: SeedOptions = {
  adminEmail: 'admin@deskboard.local',
  adminPassword: 'admin123',
  rooms: [
    { name: 'Kiwi', capacity: 4, floor: 2, features: ['screen'] },
    { name: 'Falcon', capacity: 10, floor: 3, features: ['screen', 'whiteboard', 'videoconf'] },
    { name: 'Cedar', capacity: 20, floor: 5, features: ['videoconf', 'phone', 'whiteboard'] }
  ]
};

export const seed = (
  deps: { users: UserRepository; rooms: RoomRepository; ids: IdGen },
  options: SeedOptions = DEFAULT_SEED
): void => {
  if (!deps.users.findByEmail(options.adminEmail)) {
    deps.users.create({
      id: deps.ids.next(),
      name: 'Admin',
      email: options.adminEmail,
      role: 'admin',
      passwordHash: hashPassword(options.adminPassword),
      createdAt: new Date().toISOString()
    });
  }
  for (const room of options.rooms) {
    if (!deps.rooms.findByNameIgnoreCase(room.name)) {
      deps.rooms.create({
        id: deps.ids.next(),
        name: room.name,
        capacity: room.capacity,
        floor: room.floor,
        features: room.features,
        active: true,
        createdAt: new Date().toISOString()
      });
    }
  }
};
