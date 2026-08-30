/** Admin routes: usage report. */
import { Router } from 'express';
import { usageQuerySchema } from 'deskboard-shared';
import type { UsageService } from '../../services/usageService.js';
import type { UserRepository } from '../../repositories/types.js';
import type { TokenService } from '../../auth/jwt.js';
import { getUser, requireAdmin, requireAuth } from '../middleware/auth.js';
import { validateQuery } from '../middleware/validate.js';

export const adminRouter = (deps: {
  usage: UsageService;
  usersRepo: UserRepository;
  tokens: TokenService;
}) => {
  const router = Router();
  const requireAuthToken = requireAuth(deps.tokens, deps.usersRepo);

  router.get(
    '/usage',
    requireAuthToken,
    requireAdmin,
    validateQuery(usageQuerySchema),
    (req, res, next) => {
      try {
        const query = req.query as unknown as { from: string; to: string };
        res.json(deps.usage.report(getUser(req), query.from, query.to));
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
};
