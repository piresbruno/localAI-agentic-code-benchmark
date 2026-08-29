import { Router } from 'express';
import { z } from 'zod';
import { calendarDateSchema, idParamSchema, roomCreateSchema, roomUpdateSchema } from 'shared';
import { requireAdmin, requireAuth, type AuthenticatedRequest } from './auth-middleware.js';
import { queryString, validateBody, validateParams, validateQuery } from './validate.js';
import type { BookingService } from '../services/booking-service.js';
import type { RoomService } from '../services/room-service.js';

export function roomRoutes(rooms: RoomService, bookings: BookingService, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  /** GET /api/rooms — all rooms (active + inactive; client filters). */
  router.get('/', async (_req, res) => {
    res.json(await rooms.list());
  });

  /** POST /api/rooms — create room (admin). */
  router.post('/', requireAdmin, validateBody(roomCreateSchema), async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const room = await rooms.create(req.body, { id: auth.sub, role: auth.role });
    res.status(201).json(room);
  });

  /** PUT /api/rooms/:id — update room (admin). */
  router.put('/:id', requireAdmin, validateParams(z.object({ id: idParamSchema })), validateBody(roomUpdateSchema), async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const room = await rooms.update(queryString(req.params.id)!, req.body, { id: auth.sub, role: auth.role });
    res.json(room);
  });

  /** DELETE /api/rooms/:id — soft deactivate (admin). */
  router.delete('/:id', requireAdmin, validateParams(z.object({ id: idParamSchema })), async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const room = await rooms.deactivate(queryString(req.params.id)!, { id: auth.sub, role: auth.role });
    res.json(room);
  });

  /** GET /api/rooms/:id/availability?date=YYYY-MM-DD — free/busy grid. */
  router.get(
    '/:id/availability',
    validateParams(z.object({ id: idParamSchema })),
    validateQuery(z.object({ date: calendarDateSchema })),
    async (req, res) => {
      const date = queryString(req.query.date)!;
      const { slots, roomName } = await bookings.getAvailability(queryString(req.params.id)!, date);
      res.json({ date, roomId: queryString(req.params.id)!, roomName, slots });
    },
  );

  return router;
}
