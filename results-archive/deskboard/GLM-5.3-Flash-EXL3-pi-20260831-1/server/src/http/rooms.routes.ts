import { Router } from 'express';
import { availabilityQuerySchema, roomCreateSchema, roomUpdateSchema } from '@deskboard/shared';
import type { AvailabilityService } from '../services/availability.service';
import type { RoomService } from '../services/room.service';
import { actor, parseBody, parseQuery } from './middleware';

/**
 * GET /rooms (any authenticated user), POST/PUT/DELETE /rooms (admin, enforced
 * in the service), GET /rooms/:id/availability (spec §5).
 */
export function roomsRouter(
  svc: RoomService,
  avail: AvailabilityService,
  requireAuth: ReturnType<typeof import('./middleware').requireAuth>,
): Router {
  const r = Router();
  r.get('/rooms', requireAuth, (_req, res) => {
    res.json(svc.list());
  });
  r.post('/rooms', requireAuth, (req, res) => {
    res.status(201).json(svc.create(actor(req), parseBody(req, roomCreateSchema)));
  });
  r.put('/rooms/:id', requireAuth, (req, res) => {
    res.json(svc.update(actor(req), String(req.params.id), parseBody(req, roomUpdateSchema)));
  });
  r.delete('/rooms/:id', requireAuth, (req, res) => {
    res.json(svc.deactivate(actor(req), String(req.params.id)));
  });
  r.get('/rooms/:id/availability', requireAuth, (req, res) => {
    const { date } = parseQuery(req, availabilityQuerySchema);
    res.json(avail.forRoom(String(req.params.id), date));
  });
  return r;
}
