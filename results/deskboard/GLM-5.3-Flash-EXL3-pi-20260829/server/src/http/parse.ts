/** Boundary validation helper: parses a request payload with a zod schema or raises the shared 400. */
import type { Request } from 'express';
import { ZodError, type ZodType, type ZodTypeAny } from 'zod';
import { validationError } from '@deskboard/shared';

export function parseBody<T>(req: Request, schema: ZodType<T, ZodTypeAny, ZodTypeAny>): T {
  const result = schema.safeParse(req.body);
  if (!result.success) throw toValidationError(result.error);
  return result.data;
}

export function parseQuery<T>(query: unknown, schema: ZodType<T, ZodTypeAny, ZodTypeAny>): T {
  const result = schema.safeParse(query);
  if (!result.success) throw toValidationError(result.error);
  return result.data;
}

export function toValidationError(error: ZodError): Error {
  const details = error.issues.map((issue) => ({
    field: issue.path.join('.') || '(root)',
    message: issue.message,
  }));
  return validationError(details[0]?.message ?? 'Invalid input', details);
}
