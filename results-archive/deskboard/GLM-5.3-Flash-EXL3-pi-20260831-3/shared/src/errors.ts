/**
 * Error codes shared by API responses and the client error handling.
 * Status mapping lives here too so the server has exactly one mapper (spec §5).
 */

export const ERROR_CODES = {
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  ROOM_CONFLICT: 409,
  ROOM_NAME_TAKEN: 409,
  ROOM_INACTIVE: 409,
  EMAIL_TAKEN: 409,
  CAPACITY_EXCEEDED: 422,
  RULE_VIOLATION: 422,
  CANCELLATION_WINDOW_CLOSED: 403,
  CANCEL_FORBIDDEN: 403,
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

export function statusForCode(code: ErrorCode): number {
  return ERROR_CODES[code];
}
