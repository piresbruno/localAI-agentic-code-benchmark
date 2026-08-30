// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { ApiError } from '../api/client.js';
import {
  apiErrorToFieldErrors,
  validateBookingForm,
  type BookingFormValues
} from './bookingForm.js';

const valid: BookingFormValues = {
  roomId: 'r-1',
  title: 'Kickoff',
  date: '2026-09-07',
  startTime: '09:00',
  durationMinutes: 60,
  attendees: 4,
  recurrence: 'none',
  weeklyCount: 2
};

describe('validateBookingForm', () => {
  it('accepts a valid form with no errors', () => {
    expect(validateBookingForm(valid)).toEqual({});
  });

  it('flags missing room, title and date individually', () => {
    const errors = validateBookingForm({ ...valid, roomId: '', title: '', date: '' });
    expect(errors.roomId).toBeTruthy();
    expect(errors.title).toBeTruthy();
    expect(errors.start).toBeTruthy();
  });

  it('rejects attendees below 1 and non-duration values', () => {
    expect(validateBookingForm({ ...valid, attendees: 0 }).attendees).toBeTruthy();
    expect(
      validateBookingForm({ ...valid, durationMinutes: 45 as BookingFormValues['durationMinutes'] })
        .durationMinutes
    ).toBeTruthy();
  });

  it('validates weekly counts through the shared schema', () => {
    const errors = validateBookingForm({ ...valid, recurrence: 'weekly', weeklyCount: 1 });
    expect(errors['recurrence.count']).toBeTruthy();
    expect(
      validateBookingForm({ ...valid, recurrence: 'weekly', weeklyCount: 12 })
    ).toEqual({});
  });
});

describe('apiErrorToFieldErrors', () => {
  it('maps zod field details from 400 responses to per-field messages', () => {
    const err = new ApiError('VALIDATION_ERROR', 'Invalid request body', 400, {
      fieldErrors: { title: ['Title is required'] }
    });
    expect(apiErrorToFieldErrors(err)).toEqual({ title: 'Title is required' });
  });

  it('falls back to a form-level message for rule violations', () => {
    const conflict = new ApiError('ROOM_CONFLICT', 'The room is already booked for that time', 409);
    expect(apiErrorToFieldErrors(conflict).form).toMatch(/already booked/);

    const capacity = new ApiError('RULE_VIOLATION', 'Room capacity is 6', 422, {
      capacity: 6
    });
    expect(apiErrorToFieldErrors(capacity).form).toMatch(/capacity/);
  });
});
