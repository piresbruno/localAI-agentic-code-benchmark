import { useCallback, useState } from 'react';
import type { FormEvent } from 'react';
import type { Room, RoomFeature } from '@deskboard/shared';
import { ROOM_FEATURES } from '@deskboard/shared';
import { api, ApiError } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { DataState } from '../components/DataState.js';
import { Modal } from '../components/ui/Modal.js';
import { Select } from '../components/ui/Select.js';
import { Table } from '../components/ui/Table.js';
import { TextField } from '../components/ui/TextField.js';
import { useToast } from '../components/ui/Toast.js';
import { useApiData } from '../hooks/useApiData.js';

interface RoomFormState {
  id: string | null;
  name: string;
  capacity: string;
  floor: string;
  features: RoomFeature[];
  active: boolean;
}

const EMPTY_FORM: RoomFormState = {
  id: null,
  name: '',
  capacity: '6',
  floor: '1',
  features: [],
  active: true,
};

/** Admin view: room table with add/edit modal and soft deactivation. */
export function AdminRoomsPage() {
  const toast = useToast();
  const fetcher = useCallback(() => api.get<Room[]>('/rooms'), []);
  const { data, loading, error, retry } = useApiData(fetcher);
  const [form, setForm] = useState<RoomFormState | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const rooms = data ?? [];

  async function saveRoom(event: FormEvent) {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    setFieldErrors({});
    setFormError(null);
    const payload = {
      name: form.name.trim(),
      capacity: Number(form.capacity),
      floor: Number(form.floor),
      features: form.features,
      active: form.active,
    };
    try {
      if (form.id) {
        await api.put<Room>(`/rooms/${form.id}`, payload);
        toast.success('Room updated');
      } else {
        await api.post<Room>('/rooms', payload);
        toast.success('Room added');
      }
      setForm(null);
      retry();
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
      setSaving(false);
    }
  }

  async function toggleActive(room: Room) {
    try {
      if (room.active) {
        await api.del<Room>(`/rooms/${room.id}`);
        toast.success(`${room.name} deactivated`);
      } else {
        await api.put<Room>(`/rooms/${room.id}`, { active: true });
        toast.success(`${room.name} re-activated`);
      }
      retry();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  return (
    <main className="container">
      <div className="grid-toolbar">
        <h1 className="page-title" style={{ margin: 0 }}>
          Manage rooms
        </h1>
        <span style={{ flex: 1 }} aria-hidden="true" />
        <Button onClick={() => setForm({ ...EMPTY_FORM })}>Add room</Button>
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={rooms.length === 0}
        emptyContent={<p>No rooms yet — add the first room so people can start booking.</p>}
        onRetry={retry}
      >
        <Table
          columns={[
            { header: 'Name', render: (room) => <strong>{room.name}</strong> },
            { header: 'Floor', render: (room) => room.floor },
            { header: 'Capacity', render: (room) => room.capacity },
            { header: 'Features', render: (room) => room.features.join(', ') || '—' },
            {
              header: 'Status',
              render: (room) =>
                room.active ? (
                  <span className="status-chip status-chip--confirmed">
                    <span aria-hidden="true">✓</span> active
                  </span>
                ) : (
                  <span className="status-chip status-chip--cancelled">
                    <span aria-hidden="true">✕</span> deactivated
                  </span>
                ),
            },
            {
              header: 'Actions',
              render: (room) => (
                <span className="form-actions">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      setForm({
                        id: room.id,
                        name: room.name,
                        capacity: String(room.capacity),
                        floor: String(room.floor),
                        features: [...room.features],
                        active: room.active,
                      })
                    }
                    aria-label={`Edit ${room.name}`}
                  >
                    Edit
                  </Button>
                  <Button
                    variant={room.active ? 'danger' : 'secondary'}
                    onClick={() => toggleActive(room)}
                    aria-label={
                      room.active ? `Deactivate ${room.name}` : `Re-activate ${room.name}`
                    }
                  >
                    {room.active ? 'Deactivate' : 'Re-activate'}
                  </Button>
                </span>
              ),
            },
          ]}
          rows={rooms}
          rowKey={(room) => room.id}
          emptyState={<p>No rooms yet — add the first room to open the office for bookings.</p>}
        />
      </DataState>

      <Modal
        open={form !== null}
        title={form?.id ? 'Edit room' : 'Add room'}
        onClose={() => setForm(null)}
      >
        {form && (
          <form className="form-stack" onSubmit={saveRoom} noValidate>
            <TextField
              label="Name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              error={fieldErrors.name}
            />
            <div className="form-row">
              <TextField
                label="Capacity"
                type="number"
                min={1}
                max={100}
                value={form.capacity}
                onChange={(e) => setForm({ ...form, capacity: e.target.value })}
                error={fieldErrors.capacity}
              />
              <TextField
                label="Floor"
                type="number"
                min={1}
                max={30}
                value={form.floor}
                onChange={(e) => setForm({ ...form, floor: e.target.value })}
                error={fieldErrors.floor}
              />
            </div>
            <Select
              label="Features"
              value=""
              options={[
                {
                  value: '',
                  label: form.features.length > 0 ? form.features.join(', ') : 'None selected',
                },
              ]}
              disabled
            />
            <div className="form-row">
              {ROOM_FEATURES.map((feature) => (
                <label key={feature} className="field-label" style={{ fontWeight: 400 }}>
                  <input
                    type="checkbox"
                    checked={form.features.includes(feature)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        features: e.target.checked
                          ? [...form.features, feature]
                          : form.features.filter((f) => f !== feature),
                      })
                    }
                  />{' '}
                  {feature}
                </label>
              ))}
            </div>
            {formError && (
              <p className="field-error" role="alert">
                {formError}
              </p>
            )}
            <div className="form-actions">
              <Button type="submit" loading={saving}>
                {form.id ? 'Save changes' : 'Add room'}
              </Button>
              <Button variant="secondary" onClick={() => setForm(null)} disabled={saving}>
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Modal>
    </main>
  );
}
