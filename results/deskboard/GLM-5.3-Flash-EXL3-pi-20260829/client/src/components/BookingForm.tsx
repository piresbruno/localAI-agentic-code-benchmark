/** BookingForm — room (locked when prefilled), title, date, start, duration, attendees, recurrence. */
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ROOM_FEATURES, type Room } from '@deskboard/shared';
import { ApiClientError } from '../api/client.js';
import { api } from '../api/client.js';
import { DURATION_OPTIONS, endFromStart, toMinuteString } from '../lib/slots.js';
import { Button } from './ui/Button.js';
import { Select } from './ui/Select.js';
import { TextField } from './ui/TextField.js';
import { useToast } from './ui/Toast.js';

export interface BookingFormPrefs {
  roomId?: string;
  date?: string;
  startTime?: string;
}

interface BookingFormProps {
  rooms: Room[];
  prefs: BookingFormPrefs | null;
  onClose: () => void;
  onBooked: () => void;
}

const RECURRENCE_OPTIONS = [
  { value: 'none', label: 'No recurrence' },
  ...Array.from({ length: 8 }, (_, i) => ({
    value: String(i + 2),
    label: `Weekly × ${i + 2}`,
  })),
];

export function BookingForm({ rooms, prefs, onClose, onBooked }: BookingFormProps) {
  const toast = useToast();
  const activeRooms = useMemo(() => rooms.filter((r) => r.active), [rooms]);

  const [roomId, setRoomId] = useState(prefs?.roomId ?? activeRooms[0]?.id ?? '');
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(prefs?.date ?? '');
  const [startTime, setStartTime] = useState(prefs?.startTime ?? '09:00');
  const [duration, setDuration] = useState(String(DURATION_OPTIONS[1]));
  const [attendees, setAttendees] = useState('2');
  const [recurrence, setRecurrence] = useState('none');
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (prefs?.roomId) setRoomId(prefs.roomId);
    if (prefs?.date) setDate(prefs.date);
    if (prefs?.startTime) setStartTime(prefs.startTime);
  }, [prefs]);

  const room = activeRooms.find((r) => r.id === roomId);
  const startMinute = date && startTime ? toMinuteString(date, startTime) : '';
  const endMinute = startMinute ? endFromStart(startMinute, Number(duration)) : '';

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    try {
      const count = recurrence === 'none' ? undefined : Number(recurrence);
      await api.createBooking({
        roomId,
        title,
        start: startMinute,
        end: endMinute,
        attendees: Number(attendees),
        recurrence: count ? { kind: 'weekly', count } : { kind: 'none' },
      });
      toast.showToast('Booking created');
      onBooked();
      onClose();
    } catch (err) {
      if (err instanceof ApiClientError) {
        setFormError(err.message);
        const details = err.details as Array<{ field: string; message: string }> | undefined;
        if (Array.isArray(details)) {
          const map: Record<string, string> = {};
          for (const d of details) map[d.field] = d.message;
          setFieldErrors(map);
        }
      } else {
        setFormError('Unexpected error. Please try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} aria-label="Create booking">
      <Select
        label="Room"
        value={roomId}
        onChange={setRoomId}
        disabled={Boolean(prefs?.roomId) || busy}
        options={activeRooms.map((r) => ({
          value: r.id,
          label: `${r.name} (floor ${r.floor}, up to ${r.capacity})`,
        }))}
        error={fieldErrors.roomId}
        required
      />
      {room && (
        <p style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
          Features: {room.features.length > 0 ? room.features.join(', ') : 'none'}
        </p>
      )}
      <TextField
        label="Title"
        value={title}
        onChange={setTitle}
        disabled={busy}
        required
        error={fieldErrors.title}
      />
      <div className="form-row">
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={setDate}
          disabled={busy}
          required
          error={fieldErrors.start}
        />
        <TextField
          label="Start time"
          type="time"
          value={startTime}
          onChange={setStartTime}
          disabled={busy}
          required
          error={fieldErrors.start}
        />
        <Select
          label="Duration"
          value={duration}
          onChange={setDuration}
          disabled={busy}
          options={DURATION_OPTIONS.map((d) => ({ value: String(d), label: `${d} min` }))}
        />
      </div>
      <div className="form-row">
        <TextField
          label="Attendees"
          type="number"
          value={attendees}
          onChange={setAttendees}
          disabled={busy}
          required
          error={fieldErrors.attendees}
        />
        <Select
          label="Repeats"
          value={recurrence}
          onChange={setRecurrence}
          disabled={busy}
          options={RECURRENCE_OPTIONS}
          error={fieldErrors.recurrence}
        />
      </div>
      {endMinute && (
        <p style={{ margin: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
          Ends at {endMinute.slice(11)} {recurrence !== 'none' && `· repeats ${recurrence} weeks`}
        </p>
      )}
      {formError && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', margin: 0 }}>
          {formError}
        </p>
      )}
      <div className="modal__actions" style={{ margin: 0 }}>
        <Button type="button" variant="secondary" onClick={onClose} disabled={busy}>
          Cancel
        </Button>
        <Button type="submit" loading={busy}>
          {busy ? 'Booking…' : 'Book room'}
        </Button>
      </div>
    </form>
  );
}

export const ROOM_FEATURE_KEYS = ROOM_FEATURES;
