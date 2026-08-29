/**
 * App composition root: builds the in-memory repositories, services, routers,
 * static UI serving and Swagger docs. Tests create a fresh app per test.
 */
import express from 'express';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import swaggerUi from 'swagger-ui-express';
import type { Clock, IdGen } from './ports.js';
import { InMemoryUserRepository } from './repositories/user-repository.js';
import { InMemoryRoomRepository } from './repositories/room-repository.js';
import { InMemoryBookingRepository } from './repositories/booking-repository.js';
import { UserService } from './services/user-service.js';
import { RoomService } from './services/room-service.js';
import { BookingService } from './services/booking-service.js';
import { UsageService } from './services/usage-service.js';
import { seed } from './seed/seed.js';
import { authRoutes } from './http/auth-routes.js';
import { userRoutes } from './http/user-routes.js';
import { roomRoutes } from './http/room-routes.js';
import { bookingRoutes } from './http/booking-routes.js';
import { adminRoutes } from './http/admin-routes.js';
import { apiNotFound, errorHandler } from './http/error-handler.js';
import { openapi } from './http/openapi.js';

export const DEFAULT_JWT_SECRET = 'dev-secret-change-me';

const systemClock: Clock = { now: () => new Date() };
const uuidIdGen: IdGen = { next: () => randomUUID() };

export interface AppOptions {
  clock?: Clock;
  idGen?: IdGen;
  jwtSecret?: string;
  /** Seed default rooms + admin account (default: true). */
  seed?: boolean;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');

export function createApp(options: AppOptions = {}): express.Express {
  const clock = options.clock ?? systemClock;
  const idGen = options.idGen ?? uuidIdGen;
  const secret = options.jwtSecret ?? process.env.JWT_SECRET ?? DEFAULT_JWT_SECRET;

  // Repositories are created per app instance → fresh in-memory state.
  const users = new InMemoryUserRepository();
  const rooms = new InMemoryRoomRepository();
  const bookings = new InMemoryBookingRepository();

  const userService = new UserService({ users, clock, idGen });
  const roomService = new RoomService({ rooms, clock, idGen });
  const bookingService = new BookingService({ bookings, rooms, clock, idGen });
  const usageService = new UsageService({ bookings, rooms, users });

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  if (options.seed !== false) {
    void seed({ users, rooms, clock, idGen }).catch((err: unknown) => {
      console.error('[deskboard] seeding failed:', err);
    });
  }

  app.use('/api/auth', authRoutes(userService, secret));
  app.use('/api/users', userRoutes(userService, secret));
  app.use('/api/rooms', roomRoutes(roomService, bookingService, secret));
  app.use('/api/bookings', bookingRoutes(bookingService, secret));
  app.use('/api/admin', adminRoutes(usageService, secret));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapi));
  app.use('/api', apiNotFound);

  // Serve the built client when present (tests run without a client build).
  if (existsSync(CLIENT_DIST)) {
    app.use(express.static(CLIENT_DIST));
    app.get(/^(?!\/api|\/api-docs|\/health).*/, (_req, res) => {
      res.sendFile(path.join(CLIENT_DIST, 'index.html'));
    });
  }

  app.use(errorHandler);
  return app;
}
