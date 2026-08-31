/**
 * Zod schemas — the single validation source for both sides: the server parses
 * request bodies/query strings with them, client forms pre-validate with them.
 */
import { z } from 'zod';

/** Naive local ISO-8601 at minutes precision, e.g. `2026-08-31T09:00`. */
export const DATETIME_LOCAL = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export const registerSchema = z.object({
  name: z.string().trim().min(1).max(80),
  email: z.string().trim().toLowerCase().email().max(120),
  password: z.string().min(8).max(72),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const roomCreateSchema = z.object({
  name: z.string().trim().min(1).max(60),
  capacity: z.number().int().min(1).max(100),
  floor: z.number().int().min(1).max(30),
  features: z
    .array(z.enum(['screen', 'whiteboard', 'videoconf', 'phone']))
    .default([]),
  active: z.boolean().default(true),
});
export type RoomCreateInput = z.infer<typeof roomCreateSchema>;

export const roomUpdateSchema = roomCreateSchema.partial();
export type RoomUpdateInput = z.infer<typeof roomUpdateSchema>;

export const bookingCreateSchema = z.object({
  roomId: z.string().min(1),
  title: z.string().trim().min(1).max(100),
  start: z.string().regex(DATETIME_LOCAL),
  end: z.string().regex(DATETIME_LOCAL),
  attendees: z.number().int().min(1).max(100),
});
export type BookingCreateInput = z.infer<typeof bookingCreateSchema>;

export const availabilityQuerySchema = z.object({
  date: z.string().regex(DATE_ONLY),
});
