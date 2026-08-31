import type { ErrorCode } from '@deskboard/shared';
import { statusForCode } from '@deskboard/shared';

/**
 * Domain error carrying a shared error code + a safe, user-facing message.
 * Services throw these; the HTTP layer maps them via `status` — nothing else.
 */
export class DomainError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'DomainError';
  }

  /** HTTP status derived from the shared code table. */
  get status(): number {
    return statusForCode(this.code);
  }
}
