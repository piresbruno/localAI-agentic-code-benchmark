/** Composition root: wires repositories, services, and HTTP routes into an Express app. */
import express, { type Express } from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Config } from './config.js';
import { InMemoryBookingRepository, InMemoryRoomRepository, InMemoryUserRepository } from './repositories/inMemory.js';
import { SystemClock, UuidIdGen, type Clock, type IdGen } from './services/clock.js';
import { TokenService } from './auth/tokens.js';
import { AuthService } from './services/authService.js';
import { RoomService } from './services/roomService.js';
import { BookingService } from './services/bookingService.js';
import { UsageService } from './services/usageService.js';
import { seedData } from './seed/seed.js';
import { AuthMiddleware } from './http/middleware.js';
import { authRouter } from './http/authRoutes.js';
import { roomRouter } from './http/roomRoutes.js';
import { bookingRouter } from './http/bookingRoutes.js';
import { adminRouter, userRouter } from './http/userRoutes.js';
import { errorMiddleware } from './http/errorMapper.js';
import { swaggerUiMiddleware, openapiSpec } from './http/openapi.js';

export interface AppOptions {
  clock?: Clock;
  idGen?: IdGen;
  jwtSecret?: string;
  /** Skip default seed data (used by tests that want a blank slate). */
  skipSeed?: boolean;
}

export function createApp(config: Config, options: AppOptions = {}): Express {
  const clock = options.clock ?? new SystemClock();
  const idGen = options.idGen ?? new UuidIdGen();
  const tokens = new TokenService(options.jwtSecret ?? config.jwtSecret);

  const users = new InMemoryUserRepository();
  const rooms = new InMemoryRoomRepository();
  const bookings = new InMemoryBookingRepository();

  const auth = new AuthService({ users, clock, idGen, tokens });
  const roomService = new RoomService({ rooms, clock, idGen });
  const bookingService = new BookingService({ bookings, rooms, users, clock, idGen });
  const usageService = new UsageService({ bookings, rooms, users });

  if (!options.skipSeed) {
    seedData(users, rooms, clock, idGen);
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '256kb' }));

  const authMiddleware = new AuthMiddleware(tokens, auth);

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api-docs', ...swaggerUiMiddleware());
  app.get('/api-docs.json', (_req, res) => {
    res.json(openapiSpec);
  });

  app.use('/api', authRouter(auth, authMiddleware));
  app.use('/api', roomRouter(roomService, bookingService, authMiddleware));
  app.use('/api', bookingRouter(bookingService, authMiddleware));
  app.use('/api', userRouter(auth, authMiddleware));
  app.use('/api', adminRouter(usageService, authMiddleware));

  // Unknown API routes → 404 with the shared error envelope.
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown API endpoint' } });
  });

  // Serve the built client (same origin) with SPA fallback for client-side routes.
  const clientDist = path.resolve(serverRootDir(), config.clientDistDir);
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method !== 'GET' || req.path.startsWith('/api') || req.path.startsWith('/api-docs')) {
      next();
      return;
    }
    res.sendFile(path.join(clientDist, 'index.html'), (error) => {
      if (error) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'UI build not found. Run npm run build.' } });
      }
    });
  });

  app.use(errorMiddleware);
  return app;
}

/** Server package root, stable whether running from src (tsx) or dist. */
function serverRootDir(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
}
