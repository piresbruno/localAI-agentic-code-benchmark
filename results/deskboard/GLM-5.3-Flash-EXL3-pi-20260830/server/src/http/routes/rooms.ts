/** Rooms routes: list/get availability (any authenticated user), mutations (admin only). */
import { Router } from 'express';
import {
  dateQuerySchema,
  roomInputSchema,
  roomUpdateSchema
} from 'deskboard-shared';
import type { RoomService } from '../../services/roomService.js';
import type { UserRepository } from '../../repositories/types.js';
import type { TokenService } from '../../auth/jwt.js';
import { getUser, requireAdmin, requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

export const roomsRouter = (deps: {
  rooms: RoomService;
  usersRepo: UserRepository;
  tokens: TokenService;
}) => {
  const router = Router();
  const requireAuthToken = requireAuth(deps.tokens, deps.usersRepo);

  router.get('/', requireAuthToken, (_req, res) => {
    res.json(deps.rooms.list());
  });

  router.post(
    '/',
    requireAuthToken,
    requireAdmin,
    validateBody(roomInputSchema),
    (req, res, next) => {
      try {
        res.status(201).json(deps.rooms.create(getUser(req), req.body));
      } catch (err) {
        next(err);
      }
    }
  );

  router.put(
    '/:id',
    requireAuthToken,
    requireAdmin,
    validateBody(roomUpdateSchema),
    (req, res, next) => {
      try {
        res.json(deps.rooms.update(getUser(req), req.params.id as string, req.body));
      } catch (err) {
        next(err);
      }
    }
  );

  // Soft-deactivate per spec §4 (deactivate blocks new bookings, not existing ones).
  router.delete('/:id', requireAuthToken, requireAdmin, (req, res, next) => {
    try {
      res.json(deps.rooms.deactivate(getUser(req), req.params.id as string));
    } catch (err) {
      next(err);
    }
  });

  router.get(
    '/:id/availability',
    requireAuthToken,
    validateQuery(dateQuerySchema),
    (req, res, next) => {
      try {
        res.json(deps.rooms.availability(req.params.id as string, req.query.date as string));
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
};
