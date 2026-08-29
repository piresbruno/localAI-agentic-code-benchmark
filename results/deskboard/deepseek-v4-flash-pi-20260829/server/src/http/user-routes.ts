import { Router } from 'express';
import { changePasswordSchema } from 'shared';
import { requireAuth, type AuthenticatedRequest } from './auth-middleware.js';
import { validateBody } from './validate.js';
import type { UserService } from '../services/user-service.js';

export function userRoutes(users: UserService, secret: string): Router {
  const router = Router();
  router.use(requireAuth(secret));

  /** PUT /api/users/me/password — change own password (seeded admin included). */
  router.put('/me/password', validateBody(changePasswordSchema), async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    await users.changePassword(auth.sub, req.body.currentPassword, req.body.newPassword);
    res.json({ ok: true });
  });

  return router;
}
