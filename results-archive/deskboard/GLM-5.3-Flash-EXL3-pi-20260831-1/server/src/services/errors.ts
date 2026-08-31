import type { ErrorCode } from '@deskboard/shared';

/**
 * Domain error carrying an API error code + safe message; the HTTP error mapper
 * turns it into the shared `{ error: { code, message, details? } }` response.
 */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: { field: string; message: string }[];

  constructor(code: ErrorCode, status: number, message: string, details?: AppError['details']) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export const validationError = (details: AppError['details']) =>
  new AppError('VALIDATION_ERROR', 400, 'Request validation failed.', details);
export const unauthenticated = (message = 'Authentication required.') =>
  new AppError('UNAUTHENTICATED', 401, message);
export const forbidden = (message = 'You are not allowed to perform this action.') =>
  new AppError('FORBIDDEN', 403, message);
export const notFound = (what = 'Resource') => new AppError('NOT_FOUND', 404, `${what} not found.`);
export const conflict = (code: ErrorCode, message: string) => new AppError(code, 409, message);
export const ruleViolation = (code: ErrorCode, message: string) =>
  new AppError(code, 422, message);
