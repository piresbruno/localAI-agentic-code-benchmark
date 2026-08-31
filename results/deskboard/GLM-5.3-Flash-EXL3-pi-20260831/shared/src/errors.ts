/**
 * Single error model shared by API and client: every failure response has shape
 * `{ error: { code, message, details? } }`. Status mapping lives in the server's
 * shared error mapper (http/middleware.ts).
 */
export type ErrorCode =
  | 'VALIDATION_ERROR' // 400 – request body/query failed schema validation
  | 'UNAUTHENTICATED' // 401 – missing/invalid token
  | 'INVALID_CREDENTIALS' // 401 – login failed
  | 'FORBIDDEN' // 403 – authenticated but not allowed
  | 'NOT_FOUND' // 404 – unknown resource/route
  | 'ROOM_CONFLICT' // 409 – room already booked (overlapping)
  | 'ROOM_NAME_TAKEN' // 409 – case-insensitive duplicate room name
  | 'ROOM_INACTIVE' // 409 – booking attempted on deactivated room
  | 'OVER_CAPACITY' // 422 – attendees exceed room capacity
  | 'OUTSIDE_BUSINESS_HOURS' // 422 – Mon–Fri 08:00–19:00 only
  | 'INVALID_TIME_RANGE' // 422 – end must be after start
  | 'DURATION_EXCEEDS_LIMIT' // 422 – max 4 hours
  | 'CANCELLATION_WINDOW_PASSED' // 422 – organizer < 1h before start
  | 'ALREADY_CANCELLED' // 409 – booking already cancelled
  | 'EMAIL_TAKEN' // 409 – duplicate registration email
  | 'INTERNAL'; // 500 – unexpected, details logged server-side only

export interface ErrorDetail {
  /** Field path the detail refers to, e.g. `attendees` or `start`. */
  field: string;
  message: string;
}

export interface ApiErrorBody {
  error: {
    code: ErrorCode;
    message: string;
    details?: ErrorDetail[];
  };
}
