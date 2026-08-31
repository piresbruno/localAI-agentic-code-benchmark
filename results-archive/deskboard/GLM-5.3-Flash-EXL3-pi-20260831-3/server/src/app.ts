import { existsSync } from 'node:fs';
import { join } from 'node:path';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import type { BookingRepository, RoomRepository } from './repositories/roomRepository.js';
import type { UserRepository } from './repositories/userRepository.js';
import type { Clock, IdGen } from './services/clock.js';
import { AuthService } from './services/authService.js';
import { BookingService } from './services/bookingService.js';
import { RoomService } from './services/roomService.js';
import { openApiDocument } from './http/openapi.js';
import { registerRoutes } from './http/routes.js';
import { apiNotFound, errorHandler } from './http/errorMapper.js';

export interface AppServices {
  auth: AuthService;
  rooms: RoomService;
  bookings: BookingService;
}

export interface AppDependencies {
  users: UserRepository;
  rooms: RoomRepository;
  bookings: BookingRepository;
  clock: Clock;
  ids: IdGen;
  secret: string;
  /** Built client directory to serve; omit to skip static hosting (tests). */
  clientDist?: string | null;
}

/** Composition root: wires repositories → services → HTTP boundary. */
export function createApp(deps: AppDependencies): express.Express {
  const services: AppServices = {
    auth: new AuthService(deps.users, deps.ids, deps.secret),
    rooms: new RoomService(deps.rooms, deps.ids),
    bookings: new BookingService(deps.bookings, deps.rooms, deps.clock, deps.ids),
  };

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());

  app.get(['/api/health', '/health'], (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openApiDocument));
  app.get('/api-docs.json', (_req, res) => {
    res.json(openApiDocument);
  });

  app.use('/api', registerRoutes(services, deps.secret));

  // JSON 404 for unmatched API routes, then the SPA (when built).
  app.use('/api', apiNotFound);
  if (deps.clientDist && existsSync(deps.clientDist)) {
    app.use(express.static(deps.clientDist));
    app.use((req, res, next) => {
      if (
        req.method === 'GET' &&
        !req.path.startsWith('/api') &&
        !req.path.startsWith('/api-docs')
      ) {
        return res.sendFile(join(deps.clientDist!, 'index.html'));
      }
      next();
    });
  }

  app.use(errorHandler);
  return app;
}
