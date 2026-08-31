import { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { ApiErrorBody, ERROR_CODES } from '@deskboard/shared';
import { AppError } from '../services/errors';

/**
 * The single error mapper: every failure leaves the API in the spec's shape
 * `{ error: { code, message, details? } }`. Internal errors never leak details.
 */
export function errorMiddleware(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const mapped = mapError(err);
  res.status(mapped.status).json(mapped.body);
}

export function mapError(err: unknown): { status: number; body: ApiErrorBody } {
  if (err instanceof AppError) {
    return {
      status: err.status,
      body: {
        error: {
          code: err.code,
          message: err.message,
          ...(err.details ? { details: err.details } : {}),
        },
      },
    };
  }
  if (err instanceof ZodError) {
    const fieldErrors = err.flatten().fieldErrors;
    const details: Record<string, string[]> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages) details[field] = messages;
    }
    return {
      status: 400,
      body: {
        error: { code: ERROR_CODES.VALIDATION, message: 'Request validation failed', details },
      },
    };
  }
  // Log server-side only; the response carries no internals (standards §3).
  console.error('Unhandled error:', err);
  return {
    status: 500,
    body: { error: { code: ERROR_CODES.INTERNAL, message: 'Internal server error' } },
  };
}
