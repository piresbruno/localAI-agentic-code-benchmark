import { Router } from 'express';
import { bookingCreateSchema } from '@deskboard/shared';
import type { BookingService } from '../services/booking.service';
import { actor, parseBody } from './middleware';

/** POST /bookings, GET /bookings/mine, DELETE /bookings/:id (cancel) — spec §5. */
export function bookingsRouter(
  svc: BookingService,
  requireAuth: ReturnType<typeof import('./middleware').requireAuth>,
): Router {
  const r = Router();
  r.post('/bookings', requireAuth, (req, res) => {
    res.status(201).json(svc.create(actor(req), parseBody(req, bookingCreateSchema)));
  });
  r.get('/bookings/mine', requireAuth, (req, res) => {
    res.json(svc.mine(actor(req).sub));
  });
  r.delete('/bookings/:id', requireAuth, (req, res) => {
    res.json(svc.cancel(actor(req), String(req.params.id)));
  });
  return r;
}
