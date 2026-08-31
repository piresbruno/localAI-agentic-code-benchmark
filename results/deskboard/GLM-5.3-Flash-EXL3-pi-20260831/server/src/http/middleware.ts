import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import type { ApiErrorBody } from '@deskboard/shared';
import { ZodError, type ZodTypeAny, type z } from 'zod';
import { verifyToken, type AuthUser } from '../auth/jwt';
import { AppError, unauthenticated, validationError } from '../services/errors';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by requireAuth; undefined when unauthenticated. */
    user?: AuthUser;
  }
}

function zodDetails(err: ZodError): { field: string; message: string }[] {
  return err.issues.map((i) => ({ field: i.path.join('.'), message: i.message }));
}

/** Validates a request body against a shared zod schema; throws 400 on failure. */
export function parseBody<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const result = schema.safeParse(req.body);
  if (!result.success) throw validationError(zodDetails(result.error));
  return result.data;
}

/** Validates a request query string against a shared zod schema. */
export function parseQuery<S extends ZodTypeAny>(req: Request, schema: S): z.infer<S> {
  const result = schema.safeParse(req.query);
  if (!result.success) throw validationError(zodDetails(result.error));
  return result.data;
}

/** Bearer-token authentication; attaches the AuthUser or throws 401. */
export function requireAuth(jwtSecret: string): RequestHandler {
  return (req, _res, next) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    const user = token ? verifyToken(token, jwtSecret) : null;
    if (!user) return next(unauthenticated('Missing or invalid bearer token.'));
    req.user = user;
    next();
  };
}

/** The authenticated actor; use inside handlers guarded by requireAuth. */
export function actor(req: Request): AuthUser {
  if (!req.user) throw unauthenticated();
  return req.user;
}

/**
 * The one shared error mapper (spec §5): AppError → its status,
 * malformed JSON / zod failures → 400, anything else → 500 (logged, never leaked).
 */
export const errorMapper: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    };
    res.status(err.status).json(body);
    return;
  }
  if (err instanceof ZodError || (err as { type?: string })?.type === 'entity.parse.failed') {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request body is not valid.',
        details: err instanceof ZodError ? zodDetails(err) : [{ field: 'body', message: 'Malformed JSON.' }],
      },
    });
    return;
  }
  console.error('[deskboard] unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong on our side.' } });
};
