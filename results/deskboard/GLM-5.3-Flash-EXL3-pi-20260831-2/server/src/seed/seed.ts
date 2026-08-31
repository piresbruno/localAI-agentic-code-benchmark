import { Room } from '@deskboard/shared';
import { IdGen } from '../services/ports';
import { PasswordHasher } from '../auth/passwords';
import { RoomRepository, UserRepository } from '../repositories/types';

/** Default admin account created on boot. Documented in the README. */
export const SEED_ADMIN = { email: 'admin@deskboard.local', password: 'admin123' };

const DEFAULT_ROOMS: Omit<Room, 'id' | 'active'>[] = [
  { name: 'Hudson', capacity: 8, floor: 3, features: ['screen', 'videoconf'] },
  { name: 'Erie', capacity: 4, floor: 2, features: ['whiteboard'] },
  { name: 'Ontario', capacity: 12, floor: 5, features: ['screen', 'whiteboard', 'videoconf', 'phone'] },
  { name: 'Seneca', capacity: 6, floor: 4, features: ['phone'] },
  { name: 'Champlain', capacity: 2, floor: 2, features: [] },
];

/** Idempotent seeding: creates the admin account once. */
export async function seedUsers(users: UserRepository, hasher: PasswordHasher): Promise<void> {
  if (await users.findByEmail(SEED_ADMIN.email)) return;
  await users.create({
    id: 'admin-1',
    name: 'Office Admin',
    email: SEED_ADMIN.email,
    role: 'admin',
    passwordHash: await hasher.hash(SEED_ADMIN.password),
  });
}

/** Idempotent seeding: creates the default room set once. */
export async function seedRooms(rooms: RoomRepository, ids: IdGen): Promise<void> {
  if ((await rooms.list()).length > 0) return;
  for (const room of DEFAULT_ROOMS) {
    await rooms.create({ ...room, id: ids.next(), active: true });
  }
}
