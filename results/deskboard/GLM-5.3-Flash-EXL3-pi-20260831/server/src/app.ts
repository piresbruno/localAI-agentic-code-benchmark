import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import swaggerUi from 'swagger-ui-express';
import type { Clock, IdGen } from './services/clock';
import { systemClock, uuidIdGen } from './services/clock';
import { AuthService } from './services/auth.service';
import { RoomService } from './services/room.service';
import { BookingService } from './services/booking.service';
import { AvailabilityService } from './services/availability.service';
import {
  MemoryBookingRepository,
  MemoryRoomRepository,
  MemoryUserRepository,
} from './repositories/memory';
import { seed } from './seed/seed';
import { errorMapper, requireAuth } from './http/middleware';
import { authRouter } from './http/auth.routes';
import { roomsRouter } from './http/rooms.routes';
import { bookingsRouter } from './http/bookings.routes';
import { openApiSpec } from './http/openapi';

export interface AppOptions {
  jwtSecret: string;
  /** Built SPA directory; served when it exists (npm run build creates it). */
  clientDist?: string;
  /** Injectable for tests; defaults to system clock + uuid ids. */
  clock?: Clock;
  ids?: IdGen;
}

/**
 * Composition root: wires in-memory repositories, seeds default data, mounts
 * the API routers under /api, Swagger UI at /api-docs, and the SPA fallback.
 * A new instance per call keeps integration tests isolated.
 */
export function createApp(options: AppOptions): express.Express {
  const clock = options.clock ?? systemClock;
  const ids = options.ids ?? uuidIdGen;

  const users = new MemoryUserRepository();
  const rooms = new MemoryRoomRepository();
  const bookings = new MemoryBookingRepository();
  seed(users, rooms, clock, ids);

  const authService = new AuthService(users, clock, ids, options.jwtSecret);
  const roomService = new RoomService(rooms, ids);
  const bookingService = new BookingService(bookings, rooms, users, clock, ids);
  const availabilityService = new AvailabilityService(rooms, bookings);
  const auth = requireAuth(options.jwtSecret);

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));
  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use(
    '/api',
    authRouter(authService, options.jwtSecret),
    roomsRouter(roomService, availabilityService, auth),
    bookingsRouter(bookingService, auth),
    (_req, res) => {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Route not found.' } });
    },
  );

  if (options.clientDist && fs.existsSync(path.join(options.clientDist, 'index.html'))) {
    app.use(express.static(options.clientDist));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api') && !req.path.startsWith('/api-docs')) {
        res.sendFile(path.join(options.clientDist!, 'index.html'));
      } else {
        next();
      }
    });
  }

  app.use(errorMapper);
  return app;
}
