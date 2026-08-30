/**
 * Auth middleware: token validation and role checks for protected routes.
 * Authorization decisions for business operations stay in the services.
 */
import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthenticated, type PublicUser } from 'deskboard-shared';
import type { UserRepository } from '../../repositories/types.js';
import { bearerTokenFrom, type TokenService } from '../../auth/jwt.js';

declare module 'express-serve-static-core' {
  interface Request {
    user?: PublicUser;
  }
}

export const getUser = (req: Request): PublicUser => req.user!;

export const requireAuth =
  (tokens: TokenService, users: UserRepository) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const token = bearerTokenFrom(req.headers.authorization);
    if (!token) {
      next(unauthenticated('Missing Authorization header'));
      return;
    }
    try {
      const payload = tokens.verify(token);
      const user = users.findById(payload.sub);
      if (!user) {
        next(unauthenticated('Account no longer exists'));
        return;
      }
      req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
      next();
    } catch (err) {
      next(err);
    }
  };

export const requireAdmin = (req: Request, _res: Response, next: NextFunction): void => {
  const user = getUser(req);
  if (user.role !== 'admin') {
    next(forbidden('Admin role required'));
    return;
  }
  next();
};
