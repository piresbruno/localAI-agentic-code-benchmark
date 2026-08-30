/** Express routers — request/response mapping only; business rules live in services. */
import { Router } from 'express';
import type { UserService } from '../../services/userService.js';
import type { TokenService } from '../../auth/jwt.js';
import type { UserRepository } from '../../repositories/types.js';
import { getUser, requireAuth } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { loginSchema, registerSchema } from 'deskboard-shared';

export interface AuthDeps {
  users: UserService;
  usersRepo: UserRepository;
  tokens: TokenService;
}

export const authRouter = (deps: AuthDeps) => {
  const router = Router();
  const requireAuthToken = requireAuth(deps.tokens, deps.usersRepo);

  router.post('/register', validateBody(registerSchema), (req, res, next) => {
    try {
      const user = deps.users.register(req.body);
      const pub = deps.users.toPublic(user);
      res.status(201).json({ token: deps.tokens.issue(pub), user: pub });
    } catch (err) {
      next(err);
    }
  });

  router.post('/login', validateBody(loginSchema), (req, res, next) => {
    try {
      const user = deps.users.login(req.body);
      const pub = deps.users.toPublic(user);
      res.json({ token: deps.tokens.issue(pub), user: pub });
    } catch (err) {
      next(err);
    }
  });

  router.get('/me', requireAuthToken, (req, res) => {
    res.json(getUser(req));
  });

  return router;
};
