/**
 * Zod schemas for every externally supplied payload.
 * Client and server both import these — validation is never duplicated (spec §3).
 */
import { z } from 'zod';
import { ROOM_FEATURES } from './types.js';

/** ISO-8601 local wall-clock with minutes precision, e.g. 2026-09-01T08:30 */
export const LOCAL_DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
/** Calendar date, e.g. 2026-09-01 */
export const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const localDatetimeSchema = z
  .string()
  .regex(
    LOCAL_DATETIME_PATTERN,
    'Must be a local datetime with minutes precision (YYYY-MM-DDTHH:mm)',
  );

export const dateOnlySchema = z.string().regex(DATE_ONLY_PATTERN, 'Must be a date (YYYY-MM-DD)');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Must be a valid email address'));

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(100),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const roomCreateSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, 'Name is required')
    .max(100, 'Name must be at most 100 characters'),
  capacity: z
    .number('Capacity must be a number')
    .int()
    .min(1, 'Capacity must be at least 1')
    .max(100, 'Capacity must be at most 100'),
  floor: z
    .number('Floor must be a number')
    .int()
    .min(1, 'Floor must be at least 1')
    .max(30, 'Floor must be at most 30'),
  features: z.array(z.enum(ROOM_FEATURES)).max(ROOM_FEATURES.length).default([]),
  active: z.boolean().default(true),
});

export const roomUpdateSchema = roomCreateSchema.partial();

export const bookingCreateSchema = z.object({
  roomId: z.string().min(1, 'Room is required'),
  title: z
    .string()
    .trim()
    .min(1, 'Title is required')
    .max(100, 'Title must be at most 100 characters'),
  start: localDatetimeSchema,
  end: localDatetimeSchema,
  attendees: z
    .number('Attendees must be a number')
    .int('Attendees must be a whole number')
    .min(1, 'At least one attendee is required'),
});

export const idParamSchema = z.object({
  id: z.string().min(1),
});

export const availabilityQuerySchema = z.object({
  date: dateOnlySchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
