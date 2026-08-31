import { useState, type FormEvent } from 'react';
import type { RoomDto } from '@deskboard/shared';
import { ApiError, api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { useResource } from '../hooks/useResource';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import { EmptyState, ErrorState, LoadingBlock } from '../components/States';

const FEATURES = ['screen', 'whiteboard', 'videoconf', 'phone'] as const;

/** AdminRooms (spec §6): room table + add/edit modal + soft deactivation. Admin-only route. */
export function AdminRooms() {
  const { user } = useAuth();
  const toast = useToast();
  const rooms = useResource(() => api.rooms(), []);
  const [editing, setEditing] = useState<RoomDto | 'new' | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  if (user?.role !== 'admin') {
    return <EmptyState title="Admins only">This area is restricted to administrators.</EmptyState>;
  }

  const deactivate = async (room: RoomDto) => {
    setBusyId(room.id);
    try {
      await api.deactivateRoom(room.id);
      toast.push(`Room “${room.name}” deactivated.`);
      rooms.retry();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Unexpected error.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  if (rooms.loading) return <LoadingBlock label="Loading rooms…" />;
  if (rooms.error) return <ErrorState message={rooms.error} onRetry={rooms.retry} />;

  const data = rooms.data ?? [];
  return (
    <>
      <h1 className="page-title">Manage rooms</h1>
      <p className="page-subtitle">Deactivated rooms stay listed but reject new bookings.</p>

      <div className="grid-toolbar">
        <Button onClick={() => setEditing('new')}>Add room</Button>
      </div>

      <div className="card">
        <Table
          headers={['Name', 'Floor', 'Capacity', 'Features', 'Status', 'Actions']}
          rows={
            data.length === 0
              ? null
              : data.map((room) => (
                  <tr key={room.id}>
                    <td>{room.name}</td>
                    <td>{room.floor}</td>
                    <td>{room.capacity}</td>
                    <td>{room.features.join(', ') || '—'}</td>
                    <td>
                      <span className={`badge badge--${room.active ? 'confirmed' : 'inactive'}`}>
                        <span aria-hidden="true">{room.active ? '●' : '✖'}</span> {room.active ? 'active' : 'inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                        <Button variant="secondary" onClick={() => setEditing(room)}>
                          Edit
                        </Button>
                        {room.active && (
                          <Button
                            variant="danger"
                            loading={busyId === room.id}
                            onClick={() => deactivate(room)}
                            aria-label={`Deactivate ${room.name}`}
                          >
                            Deactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
          }
          empty="No rooms yet — add the first one."
        />
      </div>

      <RoomModal room={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); rooms.retry(); }} />
    </>
  );
}

function RoomModal({
  room,
  onClose,
  onSaved,
}: {
  room: RoomDto | 'new' | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const isNew = room === 'new';
  const existing = isNew || room === null ? null : room;
  const [name, setName] = useState(existing?.name ?? '');
  const [capacity, setCapacity] = useState(existing?.capacity ?? 6);
  const [floor, setFloor] = useState(existing?.floor ?? 1);
  const [features, setFeatures] = useState<string[]>(existing?.features ?? []);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const payload = { name: name.trim(), capacity, floor, features };
    if (payload.name.length === 0) {
      setErrors({ name: 'Name is required' });
      return;
    }
    setPending(true);
    setErrors({});
    try {
      if (isNew) await api.createRoom(payload);
      else await api.updateRoom((room as RoomDto).id, payload);
      toast.push(isNew ? 'Room created.' : 'Room updated.');
      onSaved();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Unexpected error.', 'error');
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal open={room !== null} title={isNew ? 'Add room' : 'Edit room'} onClose={onClose}>
      <form onSubmit={submit} noValidate>
        <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} error={errors['name']} />
        <div className="form-grid">
          <TextField
            label="Capacity"
            type="number"
            min={1}
            max={100}
            value={capacity}
            onChange={(e) => setCapacity(Number(e.target.value))}
          />
          <TextField
            label="Floor"
            type="number"
            min={1}
            max={30}
            value={floor}
            onChange={(e) => setFloor(Number(e.target.value))}
          />
        </div>
        <div className="checkbox-row" role="group" aria-label="Features">
          {FEATURES.map((f) => (
            <label key={f}>
              <input
                type="checkbox"
                checked={features.includes(f)}
                onChange={(e) =>
                  setFeatures(e.target.checked ? [...features, f] : features.filter((x) => x !== f))
                }
              />
              {f}
            </label>
          ))}
        </div>
        <div className="modal__actions">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={pending}>
            {isNew ? 'Create room' : 'Save changes'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
