import { Room, RoomFeature, ROOM_FEATURES } from '@deskboard/shared';
import { FormEvent, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { TextField } from '../components/ui/TextField';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { DataView } from './DataView';

interface RoomDraft {
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
  active: boolean;
}

const emptyDraft: RoomDraft = { name: '', capacity: 6, floor: 1, features: [], active: true };

/** Admin-only room management: add/edit modal + soft deactivation. */
export function AdminRooms() {
  const { user } = useAuth();
  const showToast = useToast();
  const { data, loading, error, retry } = useAsync(
    async () => (user?.role === 'admin' ? api.listRooms() : []),
    [user?.role],
  );
  const [editing, setEditing] = useState<Room | null>(null);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const rooms = data ?? [];

  if (user?.role !== 'admin') {
    return (
      <section aria-labelledby="admin-heading">
        <h1 id="admin-heading">Admin rooms</h1>
        <div className="data-empty" role="alert">
          <p>⚠ Admin access is required to manage rooms.</p>
        </div>
      </section>
    );
  }

  async function save(draft: RoomDraft, target: Room | null) {
    if (busy) return;
    setBusy(true);
    setFormError(null);
    try {
      if (target) {
        await api.updateRoom(target.id, draft);
        showToast('Room updated');
      } else {
        await api.createRoom(draft);
        showToast('Room added');
      }
      setEditing(null);
      setCreating(false);
      retry();
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Could not save the room');
    } finally {
      setBusy(false);
    }
  }

  async function deactivate(room: Room) {
    if (busy) return;
    setBusy(true);
    try {
      await api.deactivateRoom(room.id);
      showToast(`${room.name} deactivated`);
      retry();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not deactivate the room', 'error');
    } finally {
      setBusy(false);
    }
  }

  const modalOpen = creating || editing !== null;

  return (
    <section aria-labelledby="admin-heading">
      <div className="page-head">
        <h1 id="admin-heading">Manage rooms</h1>
        <Button onClick={() => setCreating(true)}>Add room</Button>
      </div>

      <DataView
        loading={loading}
        error={error}
        retry={retry}
        isEmpty={rooms.length === 0}
        empty={
          <div className="data-empty">
            <p>No rooms yet — add the first room to open the office.</p>
            <Button onClick={() => setCreating(true)}>Add room</Button>
          </div>
        }
      >
        <Table
          headers={['Name', 'Floor', 'Capacity', 'Features', 'Status', 'Actions']}
          count={rooms.length}
          emptyMessage="No rooms found."
        >
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>{room.name}</td>
              <td>{room.floor}</td>
              <td>{room.capacity}</td>
              <td>{room.features.length ? room.features.join(', ') : '—'}</td>
              <td>
                <span className={`badge badge-${room.active ? 'confirmed' : 'cancelled'}`}>
                  <span aria-hidden="true">{room.active ? '●' : '⊘'}</span>{' '}
                  {room.active ? 'Active' : 'Deactivated'}
                </span>
              </td>
              <td className="actions-cell">
                <Button variant="secondary" onClick={() => setEditing(room)}>
                  Edit
                </Button>
                {room.active && (
                  <Button
                    variant="danger"
                    loading={busy}
                    disabled={busy}
                    title="Rooms stay listed but stop accepting new bookings"
                    onClick={() => deactivate(room)}
                  >
                    Deactivate
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </DataView>

      <RoomModal
        open={modalOpen}
        room={editing}
        busy={busy}
        formError={formError}
        onClose={() => {
          setCreating(false);
          setEditing(null);
          setFormError(null);
        }}
        onSave={save}
      />
    </section>
  );
}

function RoomModal({
  open,
  room,
  busy,
  formError,
  onClose,
  onSave,
}: {
  open: boolean;
  room: Room | null;
  busy: boolean;
  formError: string | null;
  onClose: () => void;
  onSave: (draft: RoomDraft, target: Room | null) => void;
}) {
  const [draft, setDraft] = useState<RoomDraft>(room ? toDraft(room) : emptyDraft);
  // Reset the draft whenever a different room opens.
  const [lastKey, setLastKey] = useState<string | null>(null);
  const modalKey = room ? `edit:${room.id}` : 'create';
  if (open && lastKey !== modalKey) {
    setLastKey(modalKey);
    setDraft(room ? toDraft(room) : emptyDraft);
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    onSave(draft, room);
  }

  const toggleFeature = (feature: RoomFeature) =>
    setDraft((current) => ({
      ...current,
      features: current.features.includes(feature)
        ? current.features.filter((f) => f !== feature)
        : [...current.features, feature],
    }));

  return (
    <Modal open={open} onClose={onClose} title={room ? `Edit ${room.name}` : 'Add room'}>
      <form onSubmit={submit} noValidate>
        <TextField
          label="Name"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          required
        />
        <TextField
          label="Capacity (1–100)"
          type="number"
          min={1}
          max={100}
          value={draft.capacity}
          onChange={(e) => setDraft({ ...draft, capacity: Number(e.target.value) })}
          required
        />
        <TextField
          label="Floor (1–30)"
          type="number"
          min={1}
          max={30}
          value={draft.floor}
          onChange={(e) => setDraft({ ...draft, floor: Number(e.target.value) })}
          required
        />
        <fieldset className="feature-picker">
          <legend>Features</legend>
          {ROOM_FEATURES.map((feature) => (
            <label key={feature} className="feature-option">
              <input
                type="checkbox"
                checked={draft.features.includes(feature)}
                onChange={() => toggleFeature(feature)}
              />{' '}
              {feature}
            </label>
          ))}
        </fieldset>
        {room && (
          <label className="feature-option">
            <input
              type="checkbox"
              checked={draft.active}
              onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
            />{' '}
            Bookable (active)
          </label>
        )}
        {formError && (
          <p className="form-error" role="alert">
            ⚠ {formError}
          </p>
        )}
        <div className="form-actions">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" loading={busy} disabled={busy}>
            {room ? 'Save changes' : 'Add room'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function toDraft(room: Room): RoomDraft {
  return {
    name: room.name,
    capacity: room.capacity,
    floor: room.floor,
    features: [...room.features],
    active: room.active,
  };
}
