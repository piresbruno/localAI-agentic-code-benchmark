import { hashPassword } from '../auth/passwords.js';
import type { UserRepository } from '../repositories/userRepository.js';
import type { RoomRepository } from '../repositories/roomRepository.js';
import type { IdGen } from '../services/clock.js';

export const SEED_ADMIN_EMAIL = 'admin@deskboard.local';
export const SEED_ADMIN_PASSWORD = 'admin123';

const SEED_ROOMS = [
  { name: 'Board Room', capacity: 12, floor: 3, features: ['screen', 'videoconf', 'phone'] },
  { name: 'Focus Pod', capacity: 2, floor: 2, features: [] },
  { name: 'Sprint Room', capacity: 8, floor: 2, features: ['screen', 'whiteboard'] },
  { name: 'All Hands', capacity: 40, floor: 1, features: ['screen', 'videoconf'] },
  { name: 'Quiet Booth', capacity: 4, floor: 4, features: ['phone'] },
] as const;

/**
 * Seeds the default admin account and starter rooms on first boot.
 * Idempotent: existing data is never overwritten.
 */
export async function seedDefaultData(
  users: UserRepository,
  rooms: RoomRepository,
  ids: IdGen,
): Promise<void> {
  if (!(await users.findByEmail(SEED_ADMIN_EMAIL))) {
    await users.create({
      id: ids.next(),
      name: 'Office Admin',
      email: SEED_ADMIN_EMAIL,
      role: 'admin',
      passwordHash: hashPassword(SEED_ADMIN_PASSWORD),
    });
  }
  if ((await rooms.list()).length === 0) {
    for (const seed of SEED_ROOMS) {
      await rooms.create({
        id: ids.next(),
        name: seed.name,
        capacity: seed.capacity,
        floor: seed.floor,
        features: [...seed.features],
        active: true,
      });
    }
  }
}
