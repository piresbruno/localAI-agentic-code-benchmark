/**
 * Domain error codes and the shared error model.
 * The server's HTTP mapper turns these into status codes; the client surfaces `message`.
 */
export const ERROR_CODES = {
  VALIDATION_FAILED: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  ROOM_CONFLICT: 409,
  RULE_VIOLATION: 422,
  INTERNAL: 500,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

/** Domain error carrying a machine-readable code + safe user-facing message. */
export class DomainError extends Error {
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

export function validationError(message: string, details?: unknown): DomainError {
  return new DomainError('VALIDATION_FAILED', message, details);
}

export function unauthenticatedError(message = 'Authentication required'): DomainError {
  return new DomainError('UNAUTHENTICATED', message);
}

export function forbiddenError(message = 'You do not have permission to do that'): DomainError {
  return new DomainError('FORBIDDEN', message);
}

export function notFoundError(message: string): DomainError {
  return new DomainError('NOT_FOUND', message);
}

export function conflictError(code: ErrorCode, message: string, details?: unknown): DomainError {
  return new DomainError(code, message, details);
}

/** Overlapping booking on the same room (spec code ROOM_CONFLICT, HTTP 409). */
export function roomConflictError(message: string, details?: unknown): DomainError {
  return new DomainError('ROOM_CONFLICT', message, details);
}

export function ruleViolationError(message: string, details?: unknown): DomainError {
  return new DomainError('RULE_VIOLATION', message, details);
}
