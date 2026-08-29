import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bookingCreateSchema, formatZodErrors } from 'shared';
import type { ZodError } from 'zod';
import type { Recurrence } from 'shared';
import { bookingsApi, roomsApi } from '../api/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/ui/Toast';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { Select } from '../components/ui/Select';
import { ErrorState, LoadingState } from '../components/States';
import {
  DURATION_OPTIONS,
  dateTimeToIso,
  startTimeOptions,
  toLocalDateString,
} from '../logic/booking';

export function BookingFormPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const prefilledRoom = params.get('room') ?? '';
  const prefilledDate = params.get('date') ?? toLocalDateString(new Date());
  const prefilledStart = params.get('start') ?? '09:00';

  const roomsQuery = useAsync(roomsApi.list, []);

  const [roomId, setRoomId] = useState(prefilledRoom);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(prefilledDate);
  const [start, setStart] = useState(prefilledStart);
  const [duration, setDuration] = useState(60);
  const [attendees, setAttendees] = useState(2);
  const [recurrenceKind, setRecurrenceKind] = useState<'none' | 'weekly'>('none');
  const [recurrenceCount, setRecurrenceCount] = useState(4);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const roomLocked = prefilledRoom !== '';

  /** Client-side validation AND the exact server shape come from shared zod. */
  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const recurrence: Recurrence =
      recurrenceKind === 'weekly' ? { kind: 'weekly', count: recurrenceCount } : { kind: 'none' };

    const parsed = bookingCreateSchema.safeParse({
      roomId,
      title,
      start: dateTimeToIso(date, start),
      durationMinutes: duration,
      attendees,
      recurrence,
    });
    if (!parsed.success) {
      setFieldErrors(formatZodErrors(parsed.error as ZodError));
      return;
    }

    setSubmitting(true);
    try {
      const created = await bookingsApi.create(parsed.data);
      const label = created.length > 1 ? `${created.length} bookings` : 'Booking created';
      toast.push('success', `${label} — ${created[0] ? created[0].roomName : ''}`);
      navigate('/my-bookings');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Something went wrong';
      setFormError(message);
      toast.push('error', message);
      setSubmitting(false);
    }
  }

  const activeRooms = useMemo(
    () => (roomsQuery.data ?? []).filter((r) => r.active),
    [roomsQuery.data],
  );

  if (roomsQuery.loading) return <LoadingState label="Loading rooms…" />;
  if (roomsQuery.error)
    return <ErrorState message={roomsQuery.error} onRetry={roomsQuery.reload} />;

  return (
    <section className="form-page">
      <h1 className="page-title">New booking</h1>
      <form className="card" onSubmit={onSubmit} noValidate>
        {roomLocked ? (
          <div className="field">
            <span className="field-label">Room</span>
            <p className="field-static">
              {activeRooms.find((r) => r.id === prefilledRoom)?.name ?? 'Selected room'} (fixed)
            </p>
          </div>
        ) : (
          <Select
            label="Room"
            value={roomId}
            onChange={(e) => setRoomId(e.target.value)}
            error={fieldErrors.roomId}
          >
            <option value="">Select a room…</option>
            {activeRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name} — floor {room.floor}, {room.capacity} seats
              </option>
            ))}
          </Select>
        )}

        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title}
          placeholder="e.g. Sprint planning"
        />

        <div className="field-row">
          <TextField
            label="Date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            error={fieldErrors.start}
          />
          <Select
            label="Start time"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            error={fieldErrors.start}
          >
            {startTimeOptions().map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select
            label="Duration"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </Select>
        </div>

        <div className="field-row">
          <TextField
            label="Attendees"
            type="number"
            min={1}
            max={100}
            value={attendees}
            onChange={(e) => setAttendees(Number(e.target.value))}
            error={fieldErrors.attendees}
          />
          <Select
            label="Recurrence"
            value={recurrenceKind}
            onChange={(e) => setRecurrenceKind(e.target.value as 'none' | 'weekly')}
          >
            <option value="none">Once</option>
            <option value="weekly">Weekly</option>
          </Select>
          {recurrenceKind === 'weekly' ? (
            <Select
              label="Occurrences"
              value={recurrenceCount}
              onChange={(e) => setRecurrenceCount(Number(e.target.value))}
            >
              {[2, 3, 4, 6, 8, 12].map((n) => (
                <option key={n} value={n}>
                  {n} weeks
                </option>
              ))}
            </Select>
          ) : null}
        </div>

        {formError ? (
          <p className="form-error" role="alert">
            {formError}
          </p>
        ) : null}

        <div className="form-actions">
          <Button type="submit" loading={submitting}>
            Book room
          </Button>
          <Button type="button" variant="secondary" onClick={() => navigate(-1)}>
            Cancel
          </Button>
        </div>
      </form>
    </section>
  );
}
