import { Router } from 'express';
import {
  availabilityQuerySchema,
  bookingSchema,
  loginSchema,
  registerSchema,
  roomSchema,
} from '@deskboard/shared';
import { UserRepository } from '../repositories/types';
import { AuthService } from '../services/authService';
import { BookingService } from '../services/bookingService';
import { RoomService } from '../services/roomService';
import { requireAdmin, requireAuth } from './middleware';

export interface ApiServices {
  auth: AuthService;
  rooms: RoomService;
  bookings: BookingService;
}

/** Express 5 types route params as `string | string[]`; our routes never repeat them. */
function param(req: { params: Record<string, string | string[]> }, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? (value[0] ?? '') : value;
}

/**
 * HTTP boundary: parse input, delegate to services, format output.
 * No business rules live here (they live in the services).
 */
export function buildApiRouter(
  secret: string,
  users: UserRepository,
  services: ApiServices,
): Router {
  const router = Router();
  const auth = requireAuth(secret, users);

  router.get('/health', (_req, res) => res.json({ status: 'ok' }));

  /* ---- auth ---- */
  router.post('/auth/register', async (req, res) => {
    const input = registerSchema.parse(req.body);
    res.status(201).json(await services.auth.register(input));
  });

  router.post('/auth/login', async (req, res) => {
    const input = loginSchema.parse(req.body);
    res.json(await services.auth.login(input));
  });

  router.get('/auth/me', auth, async (req, res) => {
    res.json(await services.auth.me(req.user!.id));
  });

  /* ---- rooms ---- */
  router.get('/rooms', auth, async (_req, res) => {
    res.json(await services.rooms.list());
  });

  router.post('/rooms', auth, requireAdmin, async (req, res) => {
    const input = roomSchema.parse(req.body);
    res.status(201).json(await services.rooms.create(input));
  });

  router.put('/rooms/:id', auth, requireAdmin, async (req, res) => {
    const input = roomSchema.parse(req.body);
    res.json(await services.rooms.update(param(req, 'id'), input));
  });

  router.delete('/rooms/:id', auth, requireAdmin, async (req, res) => {
    res.json(await services.rooms.deactivate(param(req, 'id')));
  });

  router.get('/rooms/:id/availability', auth, async (req, res) => {
    const { date } = availabilityQuerySchema.parse(req.query);
    res.json(await services.bookings.availability(param(req, 'id'), date));
  });

  /* ---- bookings ---- */
  router.post('/bookings', auth, async (req, res) => {
    const cmd = bookingSchema.parse(req.body);
    res.status(201).json(await services.bookings.create(req.user!.id, cmd));
  });

  router.get('/bookings/mine', auth, async (req, res) => {
    res.json(await services.bookings.listMine(req.user!.id));
  });

  router.delete('/bookings/:id', auth, async (req, res) => {
    res.json(await services.bookings.cancel(req.user!.id, req.user!.role, param(req, 'id')));
  });

  return router;
}
