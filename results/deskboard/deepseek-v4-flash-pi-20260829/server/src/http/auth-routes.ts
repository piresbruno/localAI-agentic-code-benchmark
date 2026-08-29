import { Router } from 'express';
import type { UserService } from '../services/user-service.js';
import { issueToken } from '../auth/token.js';
import { requireAuth, type AuthenticatedRequest } from './auth-middleware.js';
import { loginSchema, registerSchema } from 'shared';
import { validateBody } from './validate.js';

export function authRoutes(users: UserService, secret: string): Router {
  const router = Router();

  /** POST /api/auth/register — create an employee account and return a JWT. */
  router.post('/register', validateBody(registerSchema), async (req, res) => {
    const user = await users.register(req.body);
    res.status(201).json({ token: issueToken(secret, user.id, user.role), user });
  });

  /** POST /api/auth/login — credentials → JWT. */
  router.post('/login', validateBody(loginSchema), async (req, res) => {
    const user = await users.login(req.body.email, req.body.password);
    res.json({ token: issueToken(secret, user.id, user.role), user });
  });

  /** GET /api/auth/me — the authenticated user. */
  router.get('/me', requireAuth(secret), async (req, res) => {
    const auth = (req as AuthenticatedRequest).auth;
    res.json(await users.getById(auth.sub));
  });

  return router;
}
