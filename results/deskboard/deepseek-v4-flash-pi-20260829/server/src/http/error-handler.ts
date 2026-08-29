/**
 * One shared error mapper: DomainError → HTTP status + `{ error }` body.
 * Unhandled errors become a generic 500 (details logged server-side only).
 */
import type { NextFunction, Request, Response } from 'express';
import { DomainError } from 'shared';
import type { ApiErrorCode } from 'shared';

const STATUS_BY_CODE: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  INVALID_CREDENTIALS: 401,
  EMAIL_TAKEN: 409,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ROOM_CONFLICT: 409,
  ROOM_NAME_TAKEN: 409,
  BOOKING_NOT_ACTIVE: 409,
  RULE_VIOLATION: 422,
  INTERNAL: 500,
};

export function errorHandler(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof DomainError) {
    res.status(STATUS_BY_CODE[err.code] ?? 500).json({ error: err.toBody() });
    return;
  }
  // Never leak internals to the client; log them for operators.
  console.error('[deskboard] unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Internal server error' } });
}

/** JSON 404 for unknown /api routes. */
export function apiNotFound(req: Request, res: Response): void {
  res
    .status(404)
    .json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}
