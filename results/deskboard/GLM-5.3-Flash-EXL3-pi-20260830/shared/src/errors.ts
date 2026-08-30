/**
 * The one error model for the whole app. Domain code throws `AppError`;
 * the HTTP layer maps it to `{ error: { code, message, details? } }`.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR' // 400 — input failed schema validation
  | 'UNAUTHENTICATED' // 401 — missing/invalid/expired token
  | 'FORBIDDEN' // 403 — authenticated but not allowed
  | 'NOT_FOUND' // 404 — unknown resource
  | 'ROOM_CONFLICT' // 409 — overlapping booking
  | 'DUPLICATE_ROOM_NAME' // 409 — case-insensitive room name clash
  | 'BOOKING_ALREADY_CANCELLED' // 409 — cancel on a cancelled booking
  | 'RULE_VIOLATION'; // 422 — business rule rejection

const STATUS_BY_CODE: Record<ErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ROOM_CONFLICT: 409,
  DUPLICATE_ROOM_NAME: 409,
  BOOKING_ALREADY_CANCELLED: 409,
  RULE_VIOLATION: 422
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }

  get httpStatus(): number {
    return STATUS_BY_CODE[this.code];
  }

  toJSON(): { code: ErrorCode; message: string; details?: unknown } {
    return this.details === undefined
      ? { code: this.code, message: this.message }
      : { code: this.code, message: this.message, details: this.details };
  }
}

/** Convenience constructors for the codes used most often. */
export const validationError = (message: string, details?: unknown) =>
  new AppError('VALIDATION_ERROR', message, details);
export const unauthenticated = (message = 'Authentication required') =>
  new AppError('UNAUTHENTICATED', message);
export const forbidden = (message = 'You are not allowed to do that') =>
  new AppError('FORBIDDEN', message);
export const notFound = (message = 'Resource not found') =>
  new AppError('NOT_FOUND', message);
export const ruleViolation = (message: string, details?: unknown) =>
  new AppError('RULE_VIOLATION', message, details);
