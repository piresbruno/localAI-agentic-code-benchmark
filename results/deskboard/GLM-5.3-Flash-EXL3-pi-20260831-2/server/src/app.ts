import path from 'node:path';
import { randomUUID } from 'node:crypto';
import express, { Express, NextFunction, Request, Response } from 'express';
import swaggerUi from 'swagger-ui-express';
import { ERROR_CODES } from '@deskboard/shared';
import { jwtTokenIssuer } from './auth/jwt';
import { scryptPasswordHasher } from './auth/passwords';
import {
  MemoryBookingRepository,
  MemoryRoomRepository,
  MemoryUserRepository,
} from './repositories/memory';
import { seedRooms, seedUsers } from './seed/seed';
import { AuthService } from './services/authService';
import { BookingService } from './services/bookingService';
import { RoomService } from './services/roomService';
import { Clock, IdGen } from './services/ports';
import { AppConfig } from './config';
import { buildApiRouter, ApiServices } from './http/routes';
import { errorMiddleware } from './http/errorMapper';
import { openApiSpec } from './http/openapi';

export interface AppOverrides {
  /** Inject a fixed clock for deterministic tests. */
  clock?: Clock;
}

/**
 * Build the fully wired Express app (fresh in-memory stores, seeded admin +
 * rooms). A real database adapter would replace the memory repositories here.
 */
export async function createApp(config: AppConfig, overrides: AppOverrides = {}): Promise<Express> {
  const clock: Clock = overrides.clock ?? { now: () => new Date() };
  const ids: IdGen = { next: () => randomUUID() };

  const users = new MemoryUserRepository();
  const rooms = new MemoryRoomRepository();
  const bookings = new MemoryBookingRepository();
  await seedUsers(users, scryptPasswordHasher);
  await seedRooms(rooms, ids);

  const services: ApiServices = {
    auth: new AuthService(users, ids, scryptPasswordHasher, jwtTokenIssuer(config.jwtSecret)),
    rooms: new RoomService(rooms, ids),
    bookings: new BookingService(bookings, rooms, clock, ids),
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  const health = (_req: Request, res: Response) => res.json({ status: 'ok' });
  app.get('/health', health);

  app.use('/api', buildApiRouter(config.jwtSecret, users, services));
  app.use('/api', (_req: Request, res: Response) =>
    res.status(404).json({ error: { code: ERROR_CODES.NOT_FOUND, message: 'Unknown API endpoint' } }),
  );

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

  const clientDist = path.join(__dirname, '..', '..', 'client', 'dist');
  app.use(express.static(clientDist));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/api-docs')) {
      return next();
    }
    res.sendFile(path.join(clientDist, 'index.html'), (err) => (err ? next() : undefined));
  });

  app.use(errorMiddleware);
  return app;
}
