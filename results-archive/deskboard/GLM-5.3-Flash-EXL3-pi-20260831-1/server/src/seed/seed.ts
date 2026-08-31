import { hashPassword } from '../auth/password';
import type { Clock, IdGen } from '../services/clock';
import type { RoomRepository, RoomEntity, UserRepository } from '../repositories/types';

/** Documented dev-only credentials required by the spec (see README). */
export const SEED_ADMIN = {
  email: 'admin@deskboard.local',
  password: 'admin123',
  name: 'Office Admin',
};

// Rooms are seeded without ids; `seed()` assigns one per room.
const SEED_ROOMS: Omit<RoomEntity, 'id'>[] = [
  { name: 'Fjord', capacity: 8, floor: 3, features: ['screen', 'videoconf'], active: true },
  { name: 'Aurora', capacity: 4, floor: 2, features: ['whiteboard'], active: true },
  {
    name: 'Summit',
    capacity: 14,
    floor: 6,
    features: ['screen', 'whiteboard', 'videoconf', 'phone'],
    active: true,
  },
  { name: 'Pod', capacity: 2, floor: 1, features: ['phone'], active: true },
];

/** Seeds the admin account and default rooms once, on first boot. */
export function seed(
  users: UserRepository,
  rooms: RoomRepository,
  clock: Clock,
  ids: IdGen,
): void {
  if (!users.findByEmail(SEED_ADMIN.email)) {
    users.create({
      id: ids.next(),
      name: SEED_ADMIN.name,
      email: SEED_ADMIN.email,
      role: 'admin',
      passwordHash: hashPassword(SEED_ADMIN.password),
      createdAt: clock.now().toISOString(),
    });
  }
  for (const room of SEED_ROOMS) {
    if (!rooms.findByName(room.name)) {
      rooms.create({ ...room, id: ids.next() });
    }
  }
}
