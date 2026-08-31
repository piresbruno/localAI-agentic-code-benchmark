import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bookingCreateSchema, type RoomDto } from '@deskboard/shared';
import { ApiError, api } from '../api/client';
import { useResource } from '../hooks/useResource';
import { apiDetailErrors, schemaFieldErrors, type FieldErrors } from '../lib/validate';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { Select } from '../components/ui/Select';
import { useToast } from '../components/ui/Toast';
import { ErrorState, LoadingBlock } from '../components/States';

const DURATIONS = [30, 60, 90, 120];

/** Booking form (spec §6): room locked when prefilled, inline API error contract errors. */
export function BookingForm() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();

  const prefilledRoomId = params.get('roomId') ?? '';
  const prefilledDate = params.get('date') ?? '';
  const prefilledStart = params.get('start') ?? '';

  const roomsResource = useResource(() => api.rooms(), []);
  const rooms = useMemo(() => (roomsResource.data ?? []).filter((r) => r.active), [roomsResource.data]);

  const [roomId, setRoomId] = useState(prefilledRoomId);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(prefilledDate);
  const [start, setStart] = useState(prefilledStart);
  const [duration, setDuration] = useState(60);
  const [attendees, setAttendees] = useState(1);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [pending, setPending] = useState(false);

  const room = rooms.find((r) => r.id === roomId);
  const startOptions = Array.from({ length: 22 }, (_, i) => {
    const minutes = 8 * 60 + i * 30;
    return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
  });

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const end = addMinutes(`${date}T${start}`, duration);
    const values = { roomId, title: title.trim(), start: `${date}T${start}`, end, attendees };
    const clientErrors = schemaFieldErrors(bookingCreateSchema, values);
    setErrors(clientErrors);
    if (Object.keys(clientErrors).length > 0) return;
    setPending(true);
    try {
      await api.createBooking(values);
      toast.push('Booking created.');
      navigate('/my');
    } catch (err) {
      if (err instanceof ApiError) {
        setErrors({ ...apiDetailErrors(err.details), _form: err.details.length ? '' : err.message });
        toast.push(err.message, 'error');
      } else {
        setErrors({ _form: 'Unexpected error. Please try again.' });
      }
    } finally {
      setPending(false);
    }
  };

  if (roomsResource.loading) return <LoadingBlock label="Loading rooms…" />;
  if (roomsResource.error) return <ErrorState message={roomsResource.error} onRetry={roomsResource.retry} />;

  return (
    <div className="card" style={{ maxWidth: 560 }}>
      <h1 className="page-title">New booking</h1>
      <p className="page-subtitle">
        {room ? `Room ${room.name} · floor ${room.floor} · ${room.capacity} seats` : 'Pick a room and time slot.'}
      </p>
      {errors['_form'] && (
        <p className="field__error" role="alert">
          ⚠ {errors['_form']}
        </p>
      )}
      <form onSubmit={onSubmit} noValidate>
        <Select
          label="Room"
          value={roomId}
          onChange={(e) => setRoomId(e.target.value)}
          disabled={Boolean(prefilledRoomId)}
          error={errors['roomId']}
        >
          <option value="">Choose a room…</option>
          {rooms.map((r: RoomDto) => (
            <option key={r.id} value={r.id}>
              {r.name} (floor {r.floor}, {r.capacity} seats)
            </option>
          ))}
        </Select>
        <TextField
          label="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={errors['title']}
          placeholder="e.g. Sprint planning"
        />
        <div className="form-grid">
          <TextField label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} error={errors['start']} />
          <Select label="Start time" value={start} onChange={(e) => setStart(e.target.value)} error={errors['start']}>
            <option value="">Choose…</option>
            {startOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
          <Select label="Duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))}>
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
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
            error={errors['attendees']}
          />
        </div>
        {room && attendees > room.capacity && (
          <p className="field__error" role="alert">
            ⚠ This room fits {room.capacity} attendees.
          </p>
        )}
        <div className="form-actions">
          <Button type="submit" loading={pending}>
            Create booking
          </Button>
          <Button variant="secondary" onClick={() => navigate(-1)}>
            Back
          </Button>
        </div>
      </form>
    </div>
  );
}

function addMinutes(localIso: string, minutes: number): string {
  const d = new Date(localIso);
  d.setMinutes(d.getMinutes() + minutes);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
