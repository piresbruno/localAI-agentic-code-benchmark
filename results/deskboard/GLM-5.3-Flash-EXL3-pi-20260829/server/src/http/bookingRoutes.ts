/** Booking routes: create, mine, list (role-scoped in service), cancel. */
import { Router } from 'express';
import { z } from 'zod';
import { bookingSchema, isoDateSchema } from '@deskboard/shared';
import type { BookingService } from '../services/bookingService.js';
import type { AuthMiddleware, AuthedRequest } from './middleware.js';
import { parseBody, parseQuery } from './parse.js';

const listQuerySchema = z.object({
  date: isoDateSchema.optional(),
  roomId: z.string().optional(),
});

export function bookingRouter(bookings: BookingService, authMiddleware: AuthMiddleware): Router {
  const router = Router();

  router.post('/bookings', authMiddleware.requireAuth, (req: AuthedRequest, res) => {
    const input = parseBody(req, bookingSchema);
    res.status(201).json(bookings.create(req.user!, input));
  });

  router.get('/bookings/mine', authMiddleware.requireAuth, (req: AuthedRequest, res) => {
    res.json(bookings.listMine(req.user!));
  });

  router.get('/bookings', authMiddleware.requireAuth, (req: AuthedRequest, res) => {
    const query = parseQuery(req.query, listQuerySchema);
    res.json(bookings.list(req.user!, query));
  });

  router.delete('/bookings/:id', authMiddleware.requireAuth, (req: AuthedRequest, res) => {
    res.json(bookings.cancel(req.user!, String(req.params.id)));
  });

  return router;
}
