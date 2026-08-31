import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { DomainError } from '../services/errors.js';
import { verifyToken } from '../auth/tokens.js';
import type { TokenPayload } from './requestTypes.js';

/** Bearer-token authentication. 401 with the shared error contract on failure. */
export function requireAuth(secret: string): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization;
    const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : undefined;
    const payload: TokenPayload | null = token ? verifyToken(token, secret) : null;
    if (!payload) {
      return next(new DomainError('UNAUTHENTICATED', 'Authentication required'));
    }
    req.user = payload;
    next();
  };
}

/** Role gate to use *after* `requireAuth`. */
export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    return next(new DomainError('FORBIDDEN', 'Admin access required'));
  }
  next();
}

/** Boundary validation: parse `req.body` with a shared zod schema or fail 400. */
export function validateBody(schema: z.ZodType): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return next(
        new DomainError(
          'VALIDATION_ERROR',
          'Request validation failed',
          z.flattenError(result.error).fieldErrors,
        ),
      );
    }
    req.body = result.data;
    next();
  };
}

/** Boundary validation for query strings. */
export function validateQuery(schema: z.ZodType): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      return next(
        new DomainError(
          'VALIDATION_ERROR',
          'Query validation failed',
          z.flattenError(result.error).fieldErrors,
        ),
      );
    }
    // Express 5 makes req.query a getter; stash parsed data for handlers.
    res.locals.query = result.data;
    next();
  };
}
