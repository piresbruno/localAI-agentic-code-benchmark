/**
 * Application composition root: wires repositories, services, auth and the
 * HTTP layer. A fresh instance gives complete isolation for tests.
 */
import express, { type Express } from 'express';
import {
  InMemoryBookingRepository,
  InMemoryRoomRepository,
  InMemoryUserRepository,
  type BookingRepository,
  type RoomRepository,
  type UserRepository
} from './repositories/index.js';
import { systemClock, uuidIdGen, type Clock, type IdGen } from './services/clock.js';
import { BookingService } from './services/bookingService.js';
import { RoomService } from './services/roomService.js';
import { UserService } from './services/userService.js';
import { UsageService } from './services/usageService.js';
import { createTokenService, type TokenService } from './auth/jwt.js';
import { seed, DEFAULT_SEED, type SeedOptions } from './seed/seed.js';
import { authRouter } from './http/routes/auth.js';
import { roomsRouter } from './http/routes/rooms.js';
import { bookingsRouter } from './http/routes/bookings.js';
import { usersRouter } from './http/routes/users.js';
import { adminRouter } from './http/routes/admin.js';
import { errorHandler } from './http/middleware/errors.js';
import { registerDocsRoutes } from './http/openapi.js';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export interface AppConfig {
  jwtSecret: string;
  clock?: Clock;
  ids?: IdGen;
  seedData?: boolean;
  seedOptions?: SeedOptions;
  /** Directory containing the built client (served at /). Detected by default. */
  clientDist?: string | null;
}

export interface App {
  express: Express;
  repos: { users: UserRepository; rooms: RoomRepository; bookings: BookingRepository };
  services: {
    bookings: BookingService;
    rooms: RoomService;
    users: UserService;
    usage: UsageService;
  };
  tokens: TokenService;
}

const defaultClientDist = (): string | null => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const candidate = path.resolve(here, '../../client/dist');
  return existsSync(candidate) ? candidate : null;
};

export const createApp = (config: AppConfig): App => {
  const clock = config.clock ?? systemClock;
  const ids = config.ids ?? uuidIdGen;

  const users: UserRepository = new InMemoryUserRepository();
  const rooms: RoomRepository = new InMemoryRoomRepository();
  const bookings: BookingRepository = new InMemoryBookingRepository();

  if (config.seedData !== false) {
    seed({ users, rooms, ids }, config.seedOptions ?? DEFAULT_SEED);
  }

  const services = {
    bookings: new BookingService({ bookings, rooms, users, clock, ids }),
    rooms: new RoomService({ rooms, bookings, clock, ids }),
    users: new UserService({ users, clock, ids }),
    usage: new UsageService({ rooms, bookings, users })
  };
  const tokens = createTokenService(config.jwtSecret);

  const app = express();
  app.use(express.json({ limit: '100kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  const usersRepo = { usersRepo: users };
  app.use('/api/auth', authRouter({ ...usersRepo, users: services.users, tokens }));
  app.use('/api/rooms', roomsRouter({ ...usersRepo, rooms: services.rooms, tokens }));
  app.use(
    '/api/bookings',
    bookingsRouter({ ...usersRepo, bookings: services.bookings, tokens })
  );
  app.use('/api/users', usersRouter({ ...usersRepo, users: services.users, tokens }));
  app.use('/api/admin', adminRouter({ ...usersRepo, usage: services.usage, tokens }));

  // Unknown API routes → 404 with the error contract.
  app.use('/api', (req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.path}` } });
  });

  registerDocsRoutes(app);

  const clientDist = config.clientDist === undefined ? defaultClientDist() : config.clientDist;
  if (clientDist) {
    app.use(express.static(clientDist));
    // SPA fallback for client-side routes (never for API paths).
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/api-docs') || req.path === '/openapi.json') {
        next();
        return;
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  }

  app.use(errorHandler);
  return { express: app, repos: { users, rooms, bookings }, services, tokens };
};
