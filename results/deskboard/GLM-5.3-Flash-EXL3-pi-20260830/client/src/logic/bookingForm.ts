/**
 * Booking form validation and error mapping. Reuses the shared zod schemas —
 * the client never duplicates validation rules.
 */
import { bookingInputSchema } from 'deskboard-shared';
import { ApiError } from '../api/client.js';

export interface BookingFormValues {
  roomId: string;
  title: string;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  durationMinutes: number;
  attendees: number;
  recurrence: 'none' | 'weekly';
  weeklyCount: number;
}

export const DURATION_OPTIONS = [
  { value: '30', label: '30 minutes' },
  { value: '60', label: '60 minutes' },
  { value: '90', label: '90 minutes' },
  { value: '120', label: '120 minutes' }
];

export const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No recurrence' },
  { value: 'weekly', label: 'Weekly' }
];

export const WEEKLY_COUNT_OPTIONS = Array.from({ length: 11 }, (_, i) => ({
  value: String(i + 2),
  label: `${i + 2} weeks`
}));

/** Client-side validation with the shared schema; returns per-field messages. */
export const validateBookingForm = (
  values: BookingFormValues
): Record<string, string> => {
  const payload = {
    roomId: values.roomId,
    title: values.title,
    start: `${values.date}T${values.startTime}`,
    durationMinutes: values.durationMinutes,
    attendees: values.attendees,
    recurrence:
      values.recurrence === 'weekly'
        ? { kind: 'weekly', count: values.weeklyCount }
        : { kind: 'none' }
  };
  const result = bookingInputSchema.safeParse(payload);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = issue.path.join('.') || 'form';
    if (!errors[field]) errors[field] = issue.message;
  }
  return errors;
};

/** Maps an API error to per-field messages when possible, else a form-level message. */
export const apiErrorToFieldErrors = (err: ApiError): Record<string, string> => {
  const details = err.details as
    | { fieldErrors?: Record<string, string[] | undefined>; formErrors?: string[] }
    | undefined;
  const fieldErrors = details?.fieldErrors;
  if (fieldErrors) {
    const mapped: Record<string, string> = {};
    for (const [field, messages] of Object.entries(fieldErrors)) {
      if (messages?.length) mapped[field] = messages[0];
    }
    if (Object.keys(mapped).length > 0) return mapped;
  }
  if (err.code === 'ROOM_CONFLICT') return { form: err.message };
  if (err.code === 'RULE_VIOLATION') return { form: err.message };
  return { form: err.message };
};

/** Combines client validation and API errors for display. */
export const mergeFieldErrors = (
  ...sources: Record<string, string>[]
): Record<string, string> =>
  sources.reduce((acc, cur) => ({ ...acc, ...cur }), {} as Record<string, string>);
