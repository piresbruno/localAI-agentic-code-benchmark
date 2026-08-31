import { Room } from '@deskboard/shared';
import { FormEvent, useEffect, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Select } from '../components/ui/Select';
import { TextField } from '../components/ui/TextField';
import { useToast } from '../components/ui/Toast';
import { useAsync } from '../hooks/useAsync';
import { addMinutes, DURATION_OPTIONS, startTimeOptions } from '../lib/slots';
import { BookingPrefill } from './RoomGrid';

/** Create a booking; validates inline and surfaces the API error contract. */
export function BookingForm({
  prefill,
  onBooked,
}: {
  prefill: BookingPrefill | null;
  onBooked: () => void;
}) {
  const showToast = useToast();
  const {
    data: rooms,
    loading: roomsLoading,
    error: roomsError,
    retry,
  } = useAsync(() => api.listRooms(), []);

  const [roomId, setRoomId] = useState(prefill?.roomId ?? '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(prefill?.date ?? '');
  const [start, setStart] = useState(prefill?.start ?? '09:00');
  const [duration, setDuration] = useState(60);
  const [attendees, setAttendees] = useState(2);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [busy, setBusy] = useState(false);

  const locked = prefill !== null;
  const roomList = rooms ?? [];
  useEffect(() => {
    if (!roomId && roomList.length > 0) setRoomId(roomList[0].id);
  }, [roomId, roomList]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setFormError(null);
    setFieldErrors({});
    try {
      await api.createBooking({
        roomId,
        title,
        start: `${date}T${start}`,
        end: addMinutes(`${date}T${start}`, duration),
        attendees,
      });
      showToast('Booking created');
      onBooked();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
        setFieldErrors(err.details ?? {});
      } else {
        setFormError('Something went wrong. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  if (roomsLoading) {
    return (
      <section aria-busy="true" aria-live="polite">
        <h1>New booking</h1>
        <p className="muted">Loading rooms…</p>
      </section>
    );
  }
  if (roomsError) {
    return (
      <section>
        <h1>New booking</h1>
        <div className="data-error" role="alert">
          <p>⚠ {roomsError}</p>
          <Button variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      </section>
    );
  }

  return (
    <section className="form-page" aria-labelledby="booking-heading">
      <h1 id="booking-heading">New booking</h1>
      <form onSubmit={onSubmit} noValidate className="booking-form">
        <Select
          label="Room"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={locked}
          error={fieldErrors.roomId?.[0]}
          hint={locked ? 'Room is locked to your grid selection' : undefined}
        >
          {roomList.map((room: Room) => (
            <option key={room.id} value={room.id}>
              {room.name} (floor {room.floor}, up to {room.capacity})
            </option>
          ))}
        </Select>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={fieldErrors.title?.[0]}
          maxLength={100}
        />
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={fieldErrors.start?.[0]}
        />
        <Select
          label="Start time"
          value={start}
          onChange={(e) => setStart(e.target.value)}
          error={fieldErrors.start?.[0]}
        >
          {startTimeOptions().map((time) => (
            <option key={time} value={time}>
              {time}
            </option>
          ))}
        </Select>
        <Select
          label="Duration"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          error={fieldErrors.end?.[0]}
        >
          {DURATION_OPTIONS.map((minutes) => (
            <option key={minutes} value={minutes}>
              {minutes} minutes
            </option>
          ))}
        </Select>
        <TextField
          label="Attendees"
          type="number"
          min={1}
          max={100}
          value={attendees}
          onChange={(e) => setAttendees(Number(e.target.value))}
          error={fieldErrors.attendees?.[0]}
        />
        {formError && (
          <p className="form-error" role="alert">
            ⚠ {formError}
          </p>
        )}
        <div className="form-actions">
          <Button type="submit" loading={busy} disabled={busy || !roomId || !date}>
            Book room
          </Button>
        </div>
      </form>
    </section>
  );
}
