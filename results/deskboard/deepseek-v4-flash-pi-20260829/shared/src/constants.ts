/**
 * DeskBoard business constants. Single source of truth for the shared rules
 * that both the API boundary and the UI depend on.
 */

/** Booking window (local time): bookings may only start inside 08:00–19:00 Mon–Fri. */
export const BUSINESS_HOURS = { start: 8, end: 19 } as const;

/** Maximum booking length in hours. */
export const MAX_BOOKING_HOURS = 4;

/** Duration choices exposed by the UI booking form. */
export const BOOKING_DURATIONS_MINUTES = [30, 60, 90, 120] as const;

/** Room feature catalogue. */
export const FEATURES = ['screen', 'whiteboard', 'videoconf', 'phone'] as const;

export const MIN_CAPACITY = 1;
export const MAX_CAPACITY = 100;
export const MIN_FLOOR = 1;
export const MAX_FLOOR = 30;

/** Organizer may cancel up to this many minutes before the booking start. */
export const CANCELLATION_WINDOW_MINUTES = 60;

/** Access-token lifetime. */
export const TOKEN_TTL_HOURS = 12;

/** Minimum password length (documented in README). */
export const MIN_PASSWORD_LENGTH = 8;

/** Minimum and maximum occurrences for a weekly recurrence. */
export const RECURRENCE_MIN_COUNT = 1;
export const RECURRENCE_MAX_COUNT = 52;

/** Maximum title length for bookings and rooms. */
export const MAX_TITLE_LENGTH = 100;
export const MAX_ROOM_NAME_LENGTH = 80;
export const MAX_NAME_LENGTH = 100;
