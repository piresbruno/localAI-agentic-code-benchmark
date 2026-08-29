/**
 * Shared error contract: every API error is `{ error: { code, message, details? } }`.
 * Services throw `DomainError`; the HTTP layer maps it to a status code.
 */

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'ROOM_CONFLICT',
  'ROOM_NAME_TAKEN',
  'BOOKING_NOT_ACTIVE',
  'RULE_VIOLATION',
  'INTERNAL',
] as const;

export type ApiErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  code: ApiErrorCode;
  message: string;
  details?: unknown;
}

export interface ApiErrorResponse {
  error: ApiErrorBody;
}

/**
 * Error thrown by the domain/service layer. Carries a stable machine-readable
 * code plus a human-safe message; the transport layer owns HTTP mapping.
 */
export class DomainError extends Error {
  readonly code: ApiErrorCode;
  readonly details?: unknown;

  constructor(code: ApiErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }

  toBody(): ApiErrorBody {
    return {
      code: this.code,
      message: this.message,
      ...(this.details !== undefined ? { details: this.details } : {}),
    };
  }
}

/** Build an `{ error: ... }` envelope from a domain error. */
export function toErrorResponse(error: DomainError): ApiErrorResponse {
  return { error: error.toBody() };
}
