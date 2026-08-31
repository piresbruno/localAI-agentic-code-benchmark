import { NextFunction, Request, RequestHandler, Response } from 'express';
import { User } from '@deskboard/shared';
import { verifyToken } from '../auth/jwt';
import { UserRepository } from '../repositories/types';
import { AppError } from '../services/errors';
import { ERROR_CODES } from '@deskboard/shared';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

/** Require a valid Bearer JWT; loads the account and exposes it as req.user. */
export function requireAuth(secret: string, users: UserRepository): RequestHandler {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
    const payload = token ? verifyToken(token, secret) : null;
    if (!payload) return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Authentication required'));
    const user = await users.findById(payload.sub);
    if (!user) return next(new AppError(ERROR_CODES.UNAUTHENTICATED, 'Unknown account'));
    req.user = { id: user.id, name: user.name, email: user.email, role: user.role };
    next();
  };
}

/** Require an admin account (role comes from the store, not just the token). */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    return next(new AppError(ERROR_CODES.FORBIDDEN, 'Admin role required'));
  }
  next();
}
