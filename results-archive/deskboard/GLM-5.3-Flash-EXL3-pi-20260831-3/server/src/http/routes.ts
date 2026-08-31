import { Router, type Request } from 'express';
import {
  availabilityQuerySchema,
  bookingCreateSchema,
  loginSchema,
  registerSchema,
  roomCreateSchema,
  roomUpdateSchema,
} from '@deskboard/shared';
import type { AppServices } from '../app.js';
import { requireAdmin, requireAuth, validateBody, validateQuery } from './middleware.js';

/** Express 5 types repeated params as arrays; our routes always yield plain strings. */
type IdRequest = Request<{ id: string }>;

/**
 * Thin HTTP mapping (spec §3): parse → authorize → delegate to services →
 * format. No business rules here.
 */
export function registerRoutes(services: AppServices, secret: string): Router {
  const router = Router();
  const auth = requireAuth(secret);

  // ---- auth ----
  const authRouter = Router();
  authRouter.post('/register', validateBody(registerSchema), async (req, res, next) => {
    try {
      res.status(201).json(await services.auth.register(req.body));
    } catch (err) {
      next(err);
    }
  });
  authRouter.post('/login', validateBody(loginSchema), async (req, res, next) => {
    try {
      res.json(await services.auth.login(req.body));
    } catch (err) {
      next(err);
    }
  });
  authRouter.get('/me', auth, async (req, res, next) => {
    try {
      res.json(await services.auth.me(req.user!.sub));
    } catch (err) {
      next(err);
    }
  });
  router.use('/auth', authRouter);

  // ---- rooms ----
  const roomsRouter = Router();
  roomsRouter.get('/', auth, async (_req, res, next) => {
    try {
      res.json(await services.rooms.list());
    } catch (err) {
      next(err);
    }
  });
  roomsRouter.post(
    '/',
    auth,
    requireAdmin,
    validateBody(roomCreateSchema),
    async (req, res, next) => {
      try {
        res.status(201).json(await services.rooms.create(req.user!.role, req.body));
      } catch (err) {
        next(err);
      }
    },
  );
  roomsRouter.put(
    '/:id',
    auth,
    requireAdmin,
    validateBody(roomUpdateSchema),
    async (req: IdRequest, res, next) => {
      try {
        res.json(await services.rooms.update(req.user!.role, req.params.id, req.body));
      } catch (err) {
        next(err);
      }
    },
  );
  roomsRouter.delete('/:id', auth, requireAdmin, async (req: IdRequest, res, next) => {
    try {
      res.json(await services.rooms.deactivate(req.user!.role, req.params.id));
    } catch (err) {
      next(err);
    }
  });
  roomsRouter.get(
    '/:id/availability',
    auth,
    validateQuery(availabilityQuerySchema),
    async (req: IdRequest, res, next) => {
      try {
        const { date } = res.locals.query as { date: string };
        res.json(await services.bookings.availability(req.params.id, date));
      } catch (err) {
        next(err);
      }
    },
  );
  router.use('/rooms', roomsRouter);

  // ---- bookings ----
  const bookingsRouter = Router();
  bookingsRouter.post('/', auth, validateBody(bookingCreateSchema), async (req, res, next) => {
    try {
      res.status(201).json(await services.bookings.create(req.user!.sub, req.body));
    } catch (err) {
      next(err);
    }
  });
  bookingsRouter.get('/mine', auth, async (req, res, next) => {
    try {
      res.json(await services.bookings.listMine(req.user!.sub));
    } catch (err) {
      next(err);
    }
  });
  bookingsRouter.delete('/:id', auth, async (req: IdRequest, res, next) => {
    try {
      res.json(await services.bookings.cancel(req.user!.sub, req.user!.role, req.params.id));
    } catch (err) {
      next(err);
    }
  });
  router.use('/bookings', bookingsRouter);

  return router;
}
