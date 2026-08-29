/** User + admin routes: password change, usage report. */
import { Router } from 'express';
import { passwordChangeSchema, usageQuerySchema } from '@deskboard/shared';
import type { AuthService } from '../services/authService.js';
import type { UsageService } from '../services/usageService.js';
import type { AuthMiddleware, AuthedRequest } from './middleware.js';
import { parseBody, parseQuery } from './parse.js';

export function userRouter(auth: AuthService, authMiddleware: AuthMiddleware): Router {
  const router = Router();

  router.put('/users/me/password', authMiddleware.requireAuth, async (req: AuthedRequest, res) => {
    const input = parseBody(req, passwordChangeSchema);
    await auth.changePassword(req.user!.id, input);
    res.status(204).end();
  });

  return router;
}

export function adminRouter(usage: UsageService, authMiddleware: AuthMiddleware): Router {
  const router = Router();

  router.get('/admin/usage', authMiddleware.requireAuth, async (req: AuthedRequest, res) => {
    const query = parseQuery(req.query, usageQuerySchema);
    res.json(usage.report(req.user!, query.from, query.to));
  });

  return router;
}
