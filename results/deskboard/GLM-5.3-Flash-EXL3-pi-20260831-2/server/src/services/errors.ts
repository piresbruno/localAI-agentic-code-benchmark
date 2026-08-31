import { ERROR_CODES, ErrorCode } from '@deskboard/shared';

/** HTTP status for each domain error code — the single mapping used by the error mapper. */
const STATUS_BY_CODE: Record<string, number> = {
  [ERROR_CODES.VALIDATION]: 400,
  [ERROR_CODES.UNAUTHENTICATED]: 401,
  [ERROR_CODES.FORBIDDEN]: 403,
  [ERROR_CODES.NOT_FOUND]: 404,
  [ERROR_CODES.ROOM_CONFLICT]: 409,
  [ERROR_CODES.DUPLICATE_ROOM_NAME]: 409,
  [ERROR_CODES.EMAIL_IN_USE]: 409,
  [ERROR_CODES.RULE_VIOLATION]: 422,
  [ERROR_CODES.INTERNAL]: 500,
};

/** Domain error carrying a machine-readable code and a safe, user-facing message. */
export class AppError extends Error {
  readonly code: ErrorCode;
  readonly status: number;
  readonly details?: Record<string, string[]>;

  constructor(code: ErrorCode, message: string, details?: Record<string, string[]>) {
    super(message);
    this.code = code;
    this.status = STATUS_BY_CODE[code] ?? 500;
    this.details = details;
  }
}
