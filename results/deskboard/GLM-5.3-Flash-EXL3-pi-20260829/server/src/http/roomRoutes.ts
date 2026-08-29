/** Room routes: list/get/availability (any authed user) + mutations (admin enforced in service). */
import { Router } from 'express';
import { z } from 'zod';
import { roomSchema, roomUpdateSchema, isoDateSchema } from '@deskboard/shared';
import type { RoomService } from '../services/roomService.js';
import type { BookingService } from '../services/bookingService.js';
import type { AuthMiddleware, AuthedRequest } from './middleware.js';
import { parseBody, parseQuery } from './parse.js';

const availabilityQuerySchema = z.object({ date: isoDateSchema });

export function roomRouter(
  rooms: RoomService,
  bookings: BookingService,
  authMiddleware: AuthMiddleware,
): Router {
  const router = Router();

  router.get('/rooms', authMiddleware.requireAuth, (_req, res) => {
    res.json(rooms.list());
  });

  router.get('/rooms/:id/availability', authMiddleware.requireAuth, (req, res) => {
    const query = parseQuery(req.query, availabilityQuerySchema);
    res.json(bookings.availability(String(req.params.id), query.date));
  });

  router.post('/rooms', authMiddleware.requireAuth, (req: AuthedRequest, res) => {
    const input = parseBody(req, roomSchema);
    res.status(201).json(rooms.create(req.user!, input));
  });

  router.put('/rooms/:id', authMiddleware.requireAuth, (req: AuthedRequest, res) => {
    const input = parseBody(req, roomUpdateSchema);
    res.json(rooms.update(req.user!, String(req.params.id), input));
  });

  router.delete('/rooms/:id', authMiddleware.requireAuth, (req: AuthedRequest, res) => {
    res.json(rooms.deactivate(req.user!, String(req.params.id)));
  });

  return router;
}
