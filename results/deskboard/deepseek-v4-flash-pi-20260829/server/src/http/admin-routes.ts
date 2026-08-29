import { Router } from 'express';
import { usageQuerySchema } from 'shared';
import { requireAdmin, requireAuth, type AuthenticatedRequest } from './auth-middleware.js';
import { queryString, validateQuery } from './validate.js';
import type { UsageService } from '../services/usage-service.js';

export function adminRoutes(usage: UsageService, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret), requireAdmin);

  /** GET /api/admin/usage?from=YYYY-MM-DD&to=YYYY-MM-DD — per-room usage report. */
  router.get('/usage', validateQuery(usageQuerySchema), async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    const from = queryString(req.query.from);
    const to = queryString(req.query.to);
    res.json(await usage.getUsage(from, to, { id: auth.sub, role: auth.role }));
  });

  return router;
}
