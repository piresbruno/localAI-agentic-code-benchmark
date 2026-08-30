/** Boundary validation: every request body/query is checked with shared zod schemas. */
import type { NextFunction, Request, Response } from 'express';
import { z, ZodError } from 'zod';
import { validationError } from 'deskboard-shared';

export const validateBody =
  (schema: z.ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(validationError('Invalid request body', flatten(result.error)));
      return;
    }
    req.body = result.data;
    next();
  };

export const validateQuery =
  (schema: z.ZodTypeAny) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      next(validationError('Invalid query parameters', flatten(result.error)));
      return;
    }
    req.query = result.data as typeof req.query;
    next();
  };

const flatten = (error: ZodError) => error.flatten();
