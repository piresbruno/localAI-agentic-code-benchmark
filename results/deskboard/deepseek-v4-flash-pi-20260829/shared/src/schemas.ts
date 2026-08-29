/**
 * Zod validation schemas for every API request and query parameter.
 * Single source of truth: server validates at the boundary, the client reuses
 * the same schemas for inline form errors.
 */
import { z } from 'zod';
import {
  FEATURES,
  MAX_CAPACITY,
  MAX_FLOOR,
  MAX_NAME_LENGTH,
  MAX_ROOM_NAME_LENGTH,
  MAX_TITLE_LENGTH,
  MIN_CAPACITY,
  MIN_FLOOR,
  MIN_PASSWORD_LENGTH,
  RECURRENCE_MAX_COUNT,
  RECURRENCE_MIN_COUNT,
} from './constants.js';

export const roleSchema = z.enum(['admin', 'employee']);
export const featureSchema = z.enum(FEATURES);
export const bookingStatusSchema = z.enum(['confirmed', 'cancelled', 'completed']);

export const recurrenceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('none') }),
  z.object({
    kind: z.literal('weekly'),
    count: z.number().int().min(RECURRENCE_MIN_COUNT).max(RECURRENCE_MAX_COUNT),
  }),
]);

const dateField = z.string().min(1, 'required').max(MAX_NAME_LENGTH, 'too long');
const passwordField = z
  .string()
  .min(MIN_PASSWORD_LENGTH, `at least ${MIN_PASSWORD_LENGTH} characters`)
  .max(128, 'too long');

export const registerSchema = z.object({
  name: dateField,
  email: z.string().email('invalid email address'),
  password: passwordField,
});

export const loginSchema = z.object({
  email: z.string().min(1, 'required'),
  password: z.string().min(1, 'required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'required').max(128),
  newPassword: passwordField,
});

const featuresSchema = z
  .array(featureSchema)
  .max(FEATURES.length, 'too many features')
  .refine((v) => new Set(v).size === v.length, 'duplicate features');

export const roomCreateSchema = z.object({
  name: z.string().trim().min(1, 'required').max(MAX_ROOM_NAME_LENGTH, 'too long'),
  capacity: z.number().int().min(MIN_CAPACITY, `min ${MIN_CAPACITY}`).max(MAX_CAPACITY, `max ${MAX_CAPACITY}`),
  floor: z.number().int().min(MIN_FLOOR, `min ${MIN_FLOOR}`).max(MAX_FLOOR, `max ${MAX_FLOOR}`),
  features: featuresSchema,
});

export const roomUpdateSchema = z
  .object({
    name: z.string().trim().min(1, 'required').max(MAX_ROOM_NAME_LENGTH, 'too long').optional(),
    capacity: z.number().int().min(MIN_CAPACITY).max(MAX_CAPACITY).optional(),
    floor: z.number().int().min(MIN_FLOOR).max(MAX_FLOOR).optional(),
    features: featuresSchema.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, 'nothing to update');

/**
 * ISO-8601 datetime with minute precision: seconds must be "00", fractions and
 * offset are allowed (e.g. `2026-08-30T09:00:00Z`, `09:30:00+02:00`).
 */
export const isoMinutesSchema = z.string().refine(
  (v) => {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00(\.0+)?(Z|[+-]\d{2}:\d{2})$/.test(v)) return false;
    return !Number.isNaN(Date.parse(v));
  },
  'must be ISO-8601 with minute precision (seconds = 00)',
);

export const bookingCreateSchema = z.object({
  roomId: z.string().min(1, 'required'),
  title: z.string().trim().min(1, 'required').max(MAX_TITLE_LENGTH, `max ${MAX_TITLE_LENGTH} characters`),
  start: isoMinutesSchema,
  durationMinutes: z
    .number()
    .int()
    .min(30, 'min 30 minutes')
    .max(240, 'max 4 hours')
    .refine((v) => v % 30 === 0, 'must be a multiple of 30 minutes'),
  attendees: z.number().int().min(1, 'at least 1 attendee'),
  recurrence: recurrenceSchema,
});

export const calendarDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
  .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), 'invalid calendar date');

export const idParamSchema = z.string().min(1).max(64);

export const usageQuerySchema = z
  .object({
    from: calendarDateSchema.optional(),
    to: calendarDateSchema.optional(),
  })
  .refine((v) => v.from === undefined || v.to === undefined || v.from <= v.to, 'from must be <= to');

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;
export type RecurrenceInput = z.infer<typeof recurrenceSchema>;

/** Map a ZodError to `{ field: message }` for inline form errors / API details. */
export function formatZodErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (out[key] === undefined) out[key] = issue.message;
  }
  return out;
}
