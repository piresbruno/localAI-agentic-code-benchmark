/**
 * The one shared error mapper: converts AppError / ZodError / unknown throws
 * into the API error contract `{ error: { code, message, details? } }`.
 * Unknown errors are logged server-side but never leaked to the client.
 */
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError } from 'deskboard-shared';

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.httpStatus).json({ error: err.toJSON() });
    return;
  }
  if (err instanceof ZodError) {
    res.status(400).json({
      error: { code: 'VALIDATION_ERROR', message: 'Invalid request', details: err.flatten() }
    });
    return;
  }
  console.error('[deskboard] unhandled error:', err);
  res.status(500).json({ error: { code: 'INTERNAL', message: 'Something went wrong' } });
};

export const notFoundHandler = (req: { path: string }, res: { status: (n: number) => { json: (b: unknown) => void } }): void => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.path}` } });
};
