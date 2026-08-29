/** Auth routes: register, login, me. Maps requests to AuthService — no business rules here. */
import { Router } from 'express';
import { loginSchema, registerSchema } from '@deskboard/shared';
import type { AuthService } from '../services/authService.js';
import type { AuthMiddleware, AuthedRequest } from './middleware.js';
import { parseBody } from './parse.js';

export function authRouter(auth: AuthService, authMiddleware: AuthMiddleware): Router {
  const router = Router();

  router.post('/auth/register', (req, res) => {
    const input = parseBody(req, registerSchema);
    const result = auth.register(input);
    res.status(201).json(result);
  });

  router.post('/auth/login', (req, res) => {
    const input = parseBody(req, loginSchema);
    res.json(auth.login(input));
  });

  router.get('/auth/me', authMiddleware.requireAuth, (req: AuthedRequest, res) => {
    res.json(auth.me(req.user!.id));
  });

  return router;
}
