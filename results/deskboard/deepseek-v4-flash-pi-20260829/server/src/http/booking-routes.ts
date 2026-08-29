import { Router } from 'express';
import { z } from 'zod';
import { bookingCreateSchema, calendarDateSchema, idParamSchema } from 'shared';
import { requireAuth, type AuthenticatedRequest } from './auth-middleware.js';
import { queryString, validateBody, validateParams, validateQuery } from './validate.js';
import type { BookingService } from '../services/booking-service.js';

export function bookingRoutes(bookings: BookingService, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  /** POST /api/bookings — create one booking or a weekly series. */
  router.post('/', validateBody(bookingCreateSchema), async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const created = await bookings.create(req.body, auth.sub);
    res.status(201).json(created);
  });

  /** GET /api/bookings/mine — the caller's bookings. */
  router.get('/mine', async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    res.json(await bookings.listMine(auth.sub));
  });

  /** GET /api/bookings?date=&roomId= — admin: all (filtered); employee: own. */
  router.get(
    '/',
    validateQuery(z.object({ date: calendarDateSchema.optional(), roomId: idParamSchema.optional() })),
    async (req, res) => {
      const auth = (req as AuthenticatedRequest).auth;
      const date = queryString(req.query.date);
      const roomId = queryString(req.query.roomId);
      res.json(await bookings.list({ id: auth.sub, role: auth.role }, { date, roomId }));
    },
  );

  /** DELETE /api/bookings/:id — cancel (window + ownership enforced). */
  router.delete('/:id', validateParams(z.object({ id: idParamSchema })), async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    res.json(await bookings.cancel(queryString(req.params.id)!, { id: auth.sub, role: auth.role }));
  });

  return router;
}
