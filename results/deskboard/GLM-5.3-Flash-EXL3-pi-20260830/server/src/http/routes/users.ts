/** Users routes: password change for the authenticated user. */
import { Router } from 'express';
import { passwordChangeSchema } from 'deskboard-shared';
import type { UserService } from '../../services/userService.js';
import type { UserRepository } from '../../repositories/types.js';
import type { TokenService } from '../../auth/jwt.js';
import { getUser, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';

export const usersRouter = (deps: {
  users: UserService;
  usersRepo: UserRepository;
  tokens: TokenService;
}) => {
  const router = Router();
  const requireAuthToken = requireAuth(deps.tokens, deps.usersRepo);

  router.put(
    '/me/password',
    requireAuthToken,
    validateBody(passwordChangeSchema),
    (req, res, next) => {
      try {
        const user = getUser(req);
        deps.users.changePassword(user.id, req.body.currentPassword, req.body.newPassword);
        res.json({ ok: true });
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
};
