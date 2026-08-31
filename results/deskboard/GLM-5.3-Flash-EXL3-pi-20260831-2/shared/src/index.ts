import { z } from 'zod';

/* ------------------------------------------------------------------ */
/* Domain types                                                        */
/* ------------------------------------------------------------------ */

export type Role = 'admin' | 'employee';
export type RoomFeature = 'screen' | 'whiteboard' | 'videoconf' | 'phone';
export type BookingStatus = 'confirmed' | 'cancelled' | 'completed';

export const ROOM_FEATURES = ['screen', 'whiteboard', 'videoconf', 'phone'] as const;

/** Business-rule constants shared by server validation and client UI logic. */
export const BUSINESS = {
  /** Earliest bookable hour (local time). */
  OPEN_HOUR: 8,
  /** Latest bookable end hour (local time) — an end at 19:00 is allowed. */
  CLOSE_HOUR: 19,
  /** Maximum booking duration in minutes. */
  MAX_DURATION_MIN: 240,
  /** Minimum notice for an organizer to cancel their own booking, in minutes. */
  CANCEL_WINDOW_MIN: 60,
} as const;

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface Room {
  id: string;
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
  active: boolean;
}

/** Booking as exposed over the API; times are ISO-8601 with minutes precision. */
export interface Booking {
  id: string;
  roomId: string;
  roomName: string;
  title: string;
  organizerId: string;
  start: string;
  end: string;
  status: BookingStatus;
  attendees: number;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* API error contract                                                  */
/* ------------------------------------------------------------------ */

export const ERROR_CODES = {
  VALIDATION: 'VALIDATION_ERROR',
  UNAUTHENTICATED: 'UNAUTHENTICATED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  ROOM_CONFLICT: 'ROOM_CONFLICT',
  DUPLICATE_ROOM_NAME: 'DUPLICATE_ROOM_NAME',
  EMAIL_IN_USE: 'EMAIL_IN_USE',
  RULE_VIOLATION: 'RULE_VIOLATION',
  INTERNAL: 'INTERNAL',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export interface ApiErrorBody {
  error: {
    code: ErrorCode | string;
    message: string;
    details?: Record<string, string[]>;
  };
}

/* ------------------------------------------------------------------ */
/* Validation schemas                                                  */
/* ------------------------------------------------------------------ */

/** Naive local ISO timestamp with minutes precision, e.g. 2026-09-01T14:30. */
export const ISO_MINUTES_REGEX = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
export const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('A valid email is required'),
  password: z.string().min(1, 'Password is required'),
});

export const roomSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80),
  capacity: z.coerce.number().int('Capacity must be a whole number').min(1).max(100),
  floor: z.coerce.number().int('Floor must be a whole number').min(1).max(30),
  features: z.array(z.enum(ROOM_FEATURES)).max(ROOM_FEATURES.length).default([]),
  active: z.boolean().default(true),
});

export const bookingSchema = z.object({
  roomId: z.string().min(1, 'Room is required'),
  title: z.string().trim().min(1, 'Title is required').max(100),
  start: z.string().regex(ISO_MINUTES_REGEX, 'start must be YYYY-MM-DDTHH:mm (local time)'),
  end: z.string().regex(ISO_MINUTES_REGEX, 'end must be YYYY-MM-DDTHH:mm (local time)'),
  attendees: z.coerce.number().int('Attendees must be a whole number').min(1).max(100),
});

export const availabilityQuerySchema = z.object({
  date: z.string().regex(DATE_REGEX, 'date must be YYYY-MM-DD'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;

/* ------------------------------------------------------------------ */
/* Response DTOs                                                       */
/* ------------------------------------------------------------------ */

export interface AuthResponse {
  token: string;
  user: User;
}

export interface SlotDTO {
  /** 'HH:mm' local slot start. */
  start: string;
  end: string;
  available: boolean;
  bookingId?: string;
  title?: string;
}

export interface AvailabilityDTO {
  roomId: string;
  date: string;
  slots: SlotDTO[];
}
