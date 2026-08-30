/**
 * Zod validation schemas — the single source of validation for both sides.
 * The server validates request bodies/queries with them; the client reuses
 * them for inline form validation.
 */
import { z } from 'zod';
import { ROOM_FEATURES } from './types.js';

const name = z.string().trim().min(1).max(100);
const password = z.string().min(8).max(100);

export const registerSchema = z.object({
  name,
  email: z.string().trim().toLowerCase().email(),
  password
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1)
});

export const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password
});

export const roomInputSchema = z.object({
  name,
  capacity: z.number().int().min(1).max(100),
  floor: z.number().int().min(1).max(30),
  features: z.array(z.enum(ROOM_FEATURES)).max(ROOM_FEATURES.length).default([])
});

export const roomUpdateSchema = roomInputSchema.partial().refine(
  (v) => Object.keys(v).length > 0,
  { message: 'At least one field must be provided' }
);

/** ISO local datetime with minutes precision: YYYY-MM-DDTHH:mm */
const DATETIME_MINUTES = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const bookingInputSchema = z
  .object({
    roomId: z.string().min(1),
    title: z.string().trim().min(1).max(100),
    start: z.string().regex(DATETIME_MINUTES, 'start must be YYYY-MM-DDTHH:mm'),
    durationMinutes: z.union([
      z.literal(30),
      z.literal(60),
      z.literal(90),
      z.literal(120)
    ]),
    attendees: z.number().int().min(1).max(100),
    recurrence: z
      .discriminatedUnion('kind', [
        z.object({ kind: z.literal('none') }),
        z.object({ kind: z.literal('weekly'), count: z.number().int().min(2).max(12) })
      ])
      .default({ kind: 'none' })
  })
  .strict();

export const dateQuerySchema = z.object({
  date: z.string().regex(DATE_ONLY, 'date must be YYYY-MM-DD')
});

export const bookingListQuerySchema = z.object({
  date: z.string().regex(DATE_ONLY).optional(),
  roomId: z.string().optional()
});

export const usageQuerySchema = z
  .object({
    from: z.string().regex(DATE_ONLY),
    to: z.string().regex(DATE_ONLY)
  })
  .refine((v) => v.from <= v.to, { message: 'from must be on or before to' });

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type PasswordChangeInput = z.infer<typeof passwordChangeSchema>;
export type RoomUpdatePayload = z.infer<typeof roomUpdateSchema>;
export type BookingPayload = z.infer<typeof bookingInputSchema>;
