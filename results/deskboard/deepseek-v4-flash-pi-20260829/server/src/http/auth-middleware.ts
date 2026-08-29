/**
 * Express auth middleware. Boundary only: reads the token, verifies it, exposes
 * the identity on `req.auth`. Role checks happen here for route gating; deeper
 * authorization (ownership/cancellation) lives in the services.
 */
import type { NextFunction, Request, Response } from 'express';
import { DomainError } from 'shared';
import type { TokenPayload } from '../auth/token.js';
import { verifyToken } from '../auth/token.js';

export interface AuthenticatedRequest extends Request {
  auth: TokenPayload;
}

/** Verify `Authorization: Bearer <jwt>`; 401 without a valid token. */
export function requireAuth(secret: string) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    if (!token) {
      next(new DomainError('UNAUTHORIZED', 'Authentication required'));
      return;
    }
    try {
      const payload = verifyToken(secret, token);
      (req as AuthenticatedRequest).auth = payload;
      next();
    } catch {
      next(new DomainError('UNAUTHORIZED', 'Invalid or expired token'));
    }
  };
}

/** Reject non-admin callers with 403. Must run after requireAuth. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  const auth = (req as AuthenticatedRequest).auth;
  if (!auth) {
    next(new DomainError('UNAUTHORIZED', 'Authentication required'));
    return;
  }
  if (auth.role !== 'admin') {
    next(new DomainError('FORBIDDEN', 'Admin role required'));
    return;
  }
  next();
}
