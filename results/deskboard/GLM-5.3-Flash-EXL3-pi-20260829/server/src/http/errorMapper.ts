/** One shared mapper: DomainError → HTTP status + JSON envelope. Nothing else builds error bodies. */
import type { NextFunction, Request, Response } from 'express';
import { DomainError, ERROR_CODES, type ApiError } from '@deskboard/shared';

export function sendError(res: Response, error: DomainError): void {
  const status = ERROR_CODES[error.code] ?? 500;
  const body: ApiError = {
    error: {
      code: error.code,
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    },
  };
  res.status(status).json(body);
}

/** Express 5 error-handling middleware. Unexpected errors become 500 without internals leaked. */
export function errorMiddleware(err: unknown, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof DomainError) {
    sendError(res, err);
    return;
  }
  console.error('[deskboard] unexpected error:', err); // details logged server-side only
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } });
}
