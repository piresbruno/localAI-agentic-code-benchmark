/**
 * Zod boundary validation middleware: every external input (body, query,
 * params) is validated at the edge; failures become 400 VALIDATION_ERROR
 * with per-field details.
 */
import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import { DomainError, formatZodErrors } from 'shared';

type Schema<T> = ZodType<T>;

export function validateBody<T>(schema: Schema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(new DomainError('VALIDATION_ERROR', 'Invalid request body', formatZodErrors(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateQuery<T>(schema: Schema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(new DomainError('VALIDATION_ERROR', 'Invalid query parameters', formatZodErrors(result.error)));
      return;
    }
    next();
  };
}

export function validateParams<T>(schema: Schema<T>) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(new DomainError('VALIDATION_ERROR', 'Invalid path parameters', formatZodErrors(result.error)));
      return;
    }
    next();
  };
}

/** Extract a single query string value (Express may deliver arrays). */
export function queryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}
