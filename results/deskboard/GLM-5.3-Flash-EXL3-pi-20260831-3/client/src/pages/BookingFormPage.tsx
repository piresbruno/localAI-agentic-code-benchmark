import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { BookingDto, Room } from '@deskboard/shared';
import { BOOKING_DURATION_OPTIONS } from '@deskboard/shared';
import { api, ApiError } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { Select } from '../components/ui/Select.js';
import { TextField } from '../components/ui/TextField.js';
import { useToast } from '../components/ui/Toast.js';
import { endFor, isBusinessDay } from '../lib/slots.js';

export interface BookingFormPrefill {
  roomId: string;
  date: string;
  startTime: string;
}

interface BookingFormProps {
  rooms: Room[];
  prefill?: BookingFormPrefill | null;
  onDone: () => void;
  onCancel: () => void;
}

const HOUR_OPTIONS = Array.from({ length: 11 }, (_, i) => {
  const hour = 8 + i;
  const value = `${String(hour).padStart(2, '0')}:00`;
  return { value, label: value };
});

/** Booking form: room (locked when prefilled), title, date, start, duration, attendees. */
export function BookingFormPage({ rooms, prefill, onDone, onCancel }: BookingFormProps) {
  const toast = useToast();
  const [roomId, setRoomId] = useState(prefill?.roomId ?? rooms[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(prefill?.date ?? '');
  const [startTime, setStartTime] = useState(prefill?.startTime ?? '09:00');
  const [duration, setDuration] = useState(60);
  const [attendees, setAttendees] = useState(2);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const room = useMemo(() => rooms.find((r) => r.id === roomId), [rooms, roomId]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const clientErrors: Record<string, string> = {};
    if (!room) clientErrors.roomId = 'Choose a room';
    if (!date) clientErrors.date = 'Choose a date';
    else if (!isBusinessDay(date)) clientErrors.date = 'Bookings are only allowed Monday to Friday';
    if (title.trim().length === 0) clientErrors.title = 'Title is required';
    if (!Number.isInteger(attendees) || attendees < 1)
      clientErrors.attendees = 'At least one attendee is required';
    if (room && attendees > room.capacity)
      clientErrors.attendees = `This room fits ${room.capacity} people`;
    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors);
      return;
    }

    const start = `${date}T${startTime}`;
    setSubmitting(true);
    try {
      await api.post<BookingDto>('/bookings', {
        roomId,
        title: title.trim(),
        start,
        end: endFor(start, duration),
        attendees,
      });
      toast.success('Booking created');
      onDone();
    } catch (err) {
      if (err instanceof ApiError) {
        const next: Record<string, string> = {};
        for (const [field, messages] of Object.entries(err.fieldErrors)) {
          const first = messages[0];
          if (first) next[field] = first;
        }
        setFieldErrors(next);
        setFormError(err.message);
      } else {
        setFormError('Something went wrong — please try again');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="container">
      <h1 className="page-title">New booking</h1>
      <form className="form-stack" onSubmit={onSubmit} noValidate>
        <Select
          label="Room"
          value={roomId}
          disabled={prefill !== null && prefill !== undefined}
          onChange={(e) => setRoomId(e.target.value)}
          options={rooms.map((r) => ({
            value: r.id,
            label: `${r.name} · floor ${r.floor} · ${r.capacity} people`,
          }))}
          error={fieldErrors.roomId}
        />
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title}
          placeholder="e.g. Sprint planning"
        />
        <div className="form-row">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={fieldErrors.date}
          />
          <Select
            label="Start time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            options={HOUR_OPTIONS}
          />
        </div>
        <div className="form-row">
          <Select
            label="Duration"
            value={String(duration)}
            onChange={(e) => setDuration(Number(e.target.value))}
            options={BOOKING_DURATION_OPTIONS.map((minutes) => ({
              value: String(minutes),
              label: `${minutes} min`,
            }))}
          />
          <TextField
            label="Attendees"
            type="number"
            min={1}
            value={attendees}
            onChange={(e) => setAttendees(Number(e.target.value))}
            error={fieldErrors.attendees}
            hint={room ? `Room capacity: ${room.capacity}` : undefined}
          />
        </div>
        {formError && (
          <p className="field-error" role="alert">
            {formError}
          </p>
        )}
        <div className="form-actions">
          <Button type="submit" loading={submitting}>
            Create booking
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            Back
          </Button>
        </div>
      </form>
    </main>
  );
}
