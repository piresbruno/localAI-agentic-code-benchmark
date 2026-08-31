import { Router } from 'express';
import { loginSchema, registerSchema } from '@deskboard/shared';
import type { AuthService } from '../services/auth.service';
import { actor, parseBody, requireAuth } from './middleware';

/** POST /auth/register, POST /auth/login, GET /auth/me (spec §5). */
export function authRouter(svc: AuthService, jwtSecret: string): Router {
  const r = Router();
  r.post('/auth/register', (req, res) => {
    res.status(201).json(svc.register(parseBody(req, registerSchema)));
  });
  r.post('/auth/login', (req, res) => {
    res.json(svc.login(parseBody(req, loginSchema)));
  });
  r.get('/auth/me', requireAuth(jwtSecret), (req, res) => {
    res.json(svc.me(actor(req)));
  });
  return r;
}
