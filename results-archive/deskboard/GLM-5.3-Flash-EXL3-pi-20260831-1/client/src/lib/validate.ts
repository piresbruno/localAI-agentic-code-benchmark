import type { ZodTypeAny, z } from 'zod';

export type FieldErrors = Record<string, string>;

/** Flattens a zod failure into `{ field: message }` for inline form errors. */
export function schemaFieldErrors<S extends ZodTypeAny>(schema: S, value: unknown): FieldErrors {
  const result = schema.safeParse(value);
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of (result as z.SafeParseError<unknown>).error.issues) {
    const field = issue.path.join('.') || '_form';
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
}

/** Maps an API error contract's `details` into the same shape. */
export function apiDetailErrors(details: { field: string; message: string }[] | undefined): FieldErrors {
  const errors: FieldErrors = {};
  for (const d of details ?? []) {
    if (!errors[d.field]) errors[d.field] = d.message;
  }
  return errors;
}
