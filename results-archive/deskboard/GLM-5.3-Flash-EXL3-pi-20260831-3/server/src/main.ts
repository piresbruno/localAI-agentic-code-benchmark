import { MemoryBookingRepository } from './repositories/memoryBookings.js';
import { MemoryRoomRepository } from './repositories/memoryRooms.js';
import { MemoryUserRepository } from './repositories/memoryUsers.js';
import { systemClock, uuidIdGen } from './services/clock.js';
import { seedDefaultData } from './seed/seed.js';
import { loadConfig } from './config.js';
import { createApp } from './app.js';

async function main(): Promise<void> {
  const config = loadConfig();

  const users = new MemoryUserRepository();
  const rooms = new MemoryRoomRepository();
  const bookings = new MemoryBookingRepository();
  await seedDefaultData(users, rooms, uuidIdGen);

  const app = createApp({
    users,
    rooms,
    bookings,
    clock: systemClock,
    ids: uuidIdGen,
    secret: config.secret,
    clientDist: config.clientDist,
  });

  app.listen(config.port, () => {
    console.log(`DeskBoard listening on http://localhost:${config.port}`);
    if (!config.clientDist) {
      console.log(
        '(client not built yet — run `npm run build` to serve the UI from the same origin)',
      );
    }
  });
}

void main();
