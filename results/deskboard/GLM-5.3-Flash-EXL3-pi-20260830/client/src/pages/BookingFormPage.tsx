/**
 * BookingForm — room (locked when prefilled), title, date, start time,
 * duration, attendees, recurrence. Inline validation from the shared schema
 * plus the API error contract.
 */
import { useState } from 'react';
import type { Room } from 'deskboard-shared';
import { api, ApiError } from '../api/client.js';
import { useResource } from '../hooks/useResource.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Button } from '../components/ui/Button.js';
import { Select } from '../components/ui/Select.js';
import { TextField } from '../components/ui/TextField.js';
import {
  DURATION_OPTIONS,
  RECURRENCE_OPTIONS,
  WEEKLY_COUNT_OPTIONS,
  apiErrorToFieldErrors,
  mergeFieldErrors,
  validateBookingForm,
  type BookingFormValues
} from '../logic/bookingForm.js';
import { ErrorState, LoadingState } from '../components/States.js';

export interface BookingFormPrefill {
  roomId?: string;
  date?: string;
  startTime?: string;
}

export function BookingFormPage({
  prefill,
  onBooked
}: {
  prefill: BookingFormPrefill;
  onBooked: () => void;
}) {
  const { showToast } = useToast();
  const roomsResource = useResource(() => api.rooms(), []);

  const [values, setValues] = useState<BookingFormValues>({
    roomId: prefill.roomId ?? '',
    title: '',
    date: prefill.date ?? '',
    startTime: prefill.startTime ?? '09:00',
    durationMinutes: 60,
    attendees: 1,
    recurrence: 'none',
    weeklyCount: 2
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  if (roomsResource.loading) return <LoadingState label="Loading rooms…" />;
  if (roomsResource.error) {
    return <ErrorState message={roomsResource.error} onRetry={roomsResource.retry} />;
  }

  const rooms = (roomsResource.data ?? []).filter((r) => r.active);
  const lockedRoom = Boolean(prefill.roomId);

  const set = (patch: Partial<BookingFormValues>) =>
    setValues((prev) => ({ ...prev, ...patch }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const clientErrors = validateBookingForm(values);
    if (Object.keys(clientErrors).length > 0) {
      setErrors(clientErrors);
      return;
    }
    setErrors({});
    setSubmitting(true);
    try {
      await api.createBooking({
        roomId: values.roomId,
        title: values.title,
        start: `${values.date}T${values.startTime}`,
        durationMinutes: values.durationMinutes,
        attendees: values.attendees,
        recurrence:
          values.recurrence === 'weekly'
            ? { kind: 'weekly', count: values.weeklyCount }
            : { kind: 'none' }
      });
      showToast('success', 'Booking created');
      onBooked();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors(mergeFieldErrors(apiErrorToFieldErrors(err)));
        showToast('error', err.message);
      } else {
        setErrors({ form: 'Could not reach the server. Is it running?' });
        showToast('error', 'Could not reach the server');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const roomError = errors.roomId;
  const fieldError = (path: string): string | undefined =>
    errors[path === 'attendees' ? 'attendees' : path] ?? errors.form;

  return (
    <div className="page-section">
      <h1>New booking</h1>
      {errors.form && (
        <p role="alert" style={{ color: 'var(--color-danger)' }}>
          {errors.form}
        </p>
      )}
      <form onSubmit={submit} noValidate aria-busy={submitting}>
        <div className="form-grid">
          <Select
            label="Room"
            value={values.roomId}
            disabled={lockedRoom || submitting}
            error={roomError}
            hint={lockedRoom ? 'Room is locked because you picked it from the grid' : undefined}
            onChange={(e) => set({ roomId: e.target.value })}
            options={[
              { value: '', label: lockedRoom ? '' : 'Choose a room…' },
              ...rooms.map((r: Room) => ({
                value: r.id,
                label: `${r.name} (floor ${r.floor}, ${r.capacity} seats)`
              }))
            ]}
          />
          <TextField
            label="Title"
            value={values.title}
            maxLength={100}
            disabled={submitting}
            error={fieldError('title')}
            onChange={(e) => set({ title: e.target.value })}
          />
          <TextField
            label="Date"
            type="date"
            value={values.date}
            disabled={submitting}
            error={fieldError('start')}
            onChange={(e) => set({ date: e.target.value })}
          />
          <Select
            label="Start time"
            value={values.startTime}
            disabled={submitting}
            error={fieldError('start')}
            onChange={(e) => set({ startTime: e.target.value })}
            options={Array.from({ length: 22 }, (_, i) => {
              const h = 8 + Math.floor(i / 2);
              const m = i % 2 === 0 ? '00' : '30';
              return { value: `${String(h).padStart(2, '0')}:${m}`, label: `${String(h).padStart(2, '0')}:${m}` };
            })}
          />
          <Select
            label="Duration"
            value={String(values.durationMinutes)}
            disabled={submitting}
            error={fieldError('durationMinutes')}
            onChange={(e) => set({ durationMinutes: Number(e.target.value) })}
            options={DURATION_OPTIONS}
          />
          <TextField
            label="Attendees"
            type="number"
            min={1}
            value={values.attendees}
            disabled={submitting}
            error={fieldError('attendees')}
            onChange={(e) => set({ attendees: Number(e.target.value) })}
          />
          <Select
            label="Recurrence"
            value={values.recurrence}
            disabled={submitting}
            error={fieldError('recurrence')}
            onChange={(e) => set({ recurrence: e.target.value as BookingFormValues['recurrence'] })}
            options={RECURRENCE_OPTIONS}
          />
          {values.recurrence === 'weekly' && (
            <Select
              label="Repeat for"
              value={String(values.weeklyCount)}
              disabled={submitting}
              error={fieldError('recurrence.count')}
              onChange={(e) => set({ weeklyCount: Number(e.target.value) })}
              options={WEEKLY_COUNT_OPTIONS}
            />
          )}
        </div>
        <div className="form-actions">
          <Button type="submit" loading={submitting}>
            {submitting ? 'Booking…' : 'Create booking'}
          </Button>
        </div>
      </form>
    </div>
  );
}
