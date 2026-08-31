import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiErrorBody } from '@deskboard/shared';
import { DomainError } from '../services/errors.js';

/**
 * The one shared error mapper (spec §5): every failure leaves the API as
 * `{ error: { code, message, details? } }`. Internal errors are logged
 * server-side and reduced to a safe generic message for the client.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof DomainError) {
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    };
    res.status(err.status).json(body);
    return;
  }
  console.error('[deskboard] unhandled error:', err);
  res.status(500).json({
    error: { code: 'INTERNAL', message: 'Something went wrong' } satisfies ApiErrorBody['error'],
  });
};

/** JSON 404 for unmatched /api routes (never leak the default HTML error page). */
export const apiNotFound: RequestHandler = (req, res) => {
  res.status(404).json({
    error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` },
  } satisfies { error: ApiErrorBody['error'] });
};
