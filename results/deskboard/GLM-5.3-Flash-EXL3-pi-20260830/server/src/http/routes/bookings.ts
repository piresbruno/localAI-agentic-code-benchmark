/** Bookings routes: create, list mine, list (role-scoped), cancel. */
import { Router } from 'express';
import { bookingInputSchema, bookingListQuerySchema } from 'deskboard-shared';
import type { BookingService } from '../../services/bookingService.js';
import type { UserRepository } from '../../repositories/types.js';
import type { TokenService } from '../../auth/jwt.js';
import { getUser, requireAuth } from '../middleware/auth.js';
import { validateBody, validateQuery } from '../middleware/validate.js';

export const bookingsRouter = (deps: {
  bookings: BookingService;
  usersRepo: UserRepository;
  tokens: TokenService;
}) => {
  const router = Router();
  const requireAuthToken = requireAuth(deps.tokens, deps.usersRepo);

  router.post('/', requireAuthToken, validateBody(bookingInputSchema), (req, res, next) => {
    try {
      const user = getUser(req);
      res.status(201).json(deps.bookings.create(user.id, req.body));
    } catch (err) {
      next(err);
    }
  });

  router.get('/mine', requireAuthToken, (req, res, next) => {
    try {
      res.json(deps.bookings.listMine(getUser(req).id));
    } catch (err) {
      next(err);
    }
  });

  router.get('/', requireAuthToken, validateQuery(bookingListQuerySchema), (req, res, next) => {
    try {
      const query = req.query as unknown as { date?: string; roomId?: string };
      res.json(deps.bookings.list(getUser(req), query));
    } catch (err) {
      next(err);
    }
  });

  router.delete('/:id', requireAuthToken, (req, res, next) => {
    try {
      res.json(deps.bookings.cancel(getUser(req), req.params.id as string));
    } catch (err) {
      next(err);
    }
  });

  return router;
};
