/** Zod validation schemas for every external input. Used by the server boundary and the client forms. */
import { z } from 'zod';
import { ROOM_FEATURES } from './types.js';

export const emailSchema = z
  .string()
  .trim()
  .min(1, 'Email is required')
  .email('Enter a valid email address')
  .transform((v) => v.toLowerCase());

export const registerSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(100, 'Name must be at most 100 characters'),
  email: emailSchema,
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'New password must be at least 8 characters').max(128),
});

export const roomSchema = z.object({
  name: z.string().trim().min(1, 'Room name is required').max(100, 'Room name must be at most 100 characters'),
  capacity: z.coerce
    .number({ invalid_type_error: 'Capacity must be a number' })
    .int('Capacity must be a whole number')
    .min(1, 'Capacity must be at least 1')
    .max(100, 'Capacity must be at most 100'),
  floor: z.coerce
    .number({ invalid_type_error: 'Floor must be a number' })
    .int('Floor must be a whole number')
    .min(1, 'Floor must be at least 1')
    .max(30, 'Floor must be at most 30'),
  features: z.array(z.enum(ROOM_FEATURES)).default([]),
  active: z.boolean().default(true),
});

export const roomUpdateSchema = roomSchema.partial();

/** ISO date, e.g. 2026-08-29 */
export const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format');

/** ISO-8601 datetime at minutes precision, e.g. 2026-08-29T10:30 (local office time). */
export const isoMinuteSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, 'Datetime must be in YYYY-MM-DDTHH:mm format');

export const bookingSchema = z.object({
  roomId: z.string().min(1, 'Room is required'),
  title: z.string().trim().min(1, 'Title is required').max(100, 'Title must be at most 100 characters'),
  start: isoMinuteSchema,
  end: isoMinuteSchema,
  attendees: z.coerce
    .number({ invalid_type_error: 'Attendees must be a number' })
    .int('Attendees must be a whole number')
    .min(1, 'At least one attendee is required'),
  recurrence: z
    .object({
      kind: z.literal('none'),
    })
    .or(
      z.object({
        kind: z.literal('weekly'),
        count: z.coerce
          .number()
          .int('Recurrence count must be a whole number')
          .min(1, 'Recurrence count must be at least 1')
          .max(52, 'Recurrence count must be at most 52'),
      }),
    )
    .default({ kind: 'none' }),
});

export const usageQuerySchema = z.object({
  from: isoDateSchema,
  to: isoDateSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type RoomInput = z.infer<typeof roomSchema>;
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;
export type BookingInput = z.infer<typeof bookingSchema>;
