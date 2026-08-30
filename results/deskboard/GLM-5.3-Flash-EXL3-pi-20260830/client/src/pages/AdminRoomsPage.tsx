/**
 * AdminRooms — room management (add/edit modal, deactivate) and the
 * per-room usage report.
 */
import { useState } from 'react';
import type { Room, RoomFeature, RoomUsage } from 'deskboard-shared';
import { ROOM_FEATURES } from 'deskboard-shared';
import { api, ApiError } from '../api/client.js';
import { useResource } from '../hooks/useResource.js';
import { useToast } from '../components/ui/Toast.jsx';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Modal } from '../components/ui/Modal.js';
import { Table, type TableColumn } from '../components/ui/Table.js';
import { TextField } from '../components/ui/TextField.js';
import { ErrorState, LoadingState } from '../components/States.js';
import { todayIso } from '../logic/slots.js';

interface RoomFormState {
  id?: string;
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
}

const emptyRoom = (): RoomFormState => ({ name: '', capacity: 4, floor: 1, features: [] });

export function AdminRoomsPage() {
  const { showToast } = useToast();
  const roomsResource = useResource(() => api.rooms(), []);
  const [editing, setEditing] = useState<RoomFormState | null>(null);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const [usageFrom, setUsageFrom] = useState(todayIso());
  const [usageTo, setUsageTo] = useState(todayIso());
  const [usageKey, setUsageKey] = useState(0);
  const usageResource = useResource(() => api.usage(usageFrom, usageTo), [usageFrom, usageTo, usageKey]);

  if (roomsResource.loading) return <LoadingState label="Loading rooms…" />;
  if (roomsResource.error) return <ErrorState message={roomsResource.error} onRetry={roomsResource.retry} />;

  const rooms = roomsResource.data ?? [];

  const saveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true);
    setFormErrors({});
    try {
      const payload = {
        name: editing.name,
        capacity: editing.capacity,
        floor: editing.floor,
        features: editing.features
      };
      if (editing.id) {
        await api.updateRoom(editing.id, payload);
        showToast('success', 'Room updated');
      } else {
        await api.createRoom(payload);
        showToast('success', 'Room created');
      }
      setEditing(null);
      roomsResource.retry();
    } catch (err) {
      if (err instanceof ApiError) {
        const details = err.details as { fieldErrors?: Record<string, string[]> } | undefined;
        if (details?.fieldErrors) {
          const mapped: Record<string, string> = {};
          for (const [k, v] of Object.entries(details.fieldErrors)) if (v?.length) mapped[k] = v[0];
          setFormErrors(mapped);
        }
        showToast('error', err.message);
      } else {
        showToast('error', 'Could not reach the server');
      }
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (room: Room) => {
    try {
      await api.deactivateRoom(room.id);
      showToast('success', `${room.name} deactivated`);
      roomsResource.retry();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Could not deactivate the room');
    }
  };

  const roomColumns: TableColumn<Room>[] = [
    { key: 'name', header: 'Room', render: (r) => r.name },
    { key: 'floor', header: 'Floor', render: (r) => String(r.floor) },
    { key: 'capacity', header: 'Capacity', render: (r) => String(r.capacity) },
    {
      key: 'features',
      header: 'Features',
      render: (r) =>
        r.features.length === 0 ? (
          <span className="muted">—</span>
        ) : (
          <span className="row">
            {r.features.map((f) => (
              <Badge key={f} variant="info">
                {f}
              </Badge>
            ))}
          </span>
        )
    },
    {
      key: 'active',
      header: 'Status',
      render: (r) => (
        <Badge variant={r.active ? 'success' : 'danger'}>{r.active ? 'active' : 'deactivated'}</Badge>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (r) => (
        <span className="row">
          <Button
            variant="secondary"
            aria-label={`Edit ${r.name}`}
            onClick={() =>
              setEditing({
                id: r.id,
                name: r.name,
                capacity: r.capacity,
                floor: r.floor,
                features: [...r.features]
              })
            }
          >
            Edit
          </Button>
          {r.active && (
            <Button variant="danger" aria-label={`Deactivate ${r.name}`} onClick={() => deactivate(r)}>
              Deactivate
            </Button>
          )}
        </span>
      )
    }
  ];

  const usageColumns: TableColumn<RoomUsage>[] = [
    { key: 'room', header: 'Room', render: (u) => u.room.name },
    { key: 'hours', header: 'Booked hours', render: (u) => u.totalHours.toFixed(2) },
    { key: 'count', header: '# bookings', render: (u) => String(u.bookingCount) },
    {
      key: 'top',
      header: 'Top organizer',
      render: (u) => (u.topOrganizer ? `${u.topOrganizer.name} (${u.topOrganizer.hours.toFixed(1)}h)` : '—')
    }
  ];

  const featureToggle = (f: RoomFeature) => {
    if (!editing) return;
    setEditing({
      ...editing,
      features: editing.features.includes(f)
        ? editing.features.filter((x) => x !== f)
        : [...editing.features, f]
    });
  };

  return (
    <div className="stack">
      <div className="page-section">
        <div className="section-header">
          <h1>Room management</h1>
          <Button onClick={() => setEditing(emptyRoom())}>Add room</Button>
        </div>
        <Table
          columns={roomColumns}
          rows={rooms}
          rowKey={(r) => r.id}
          emptyMessage="No rooms yet — add the first one"
        />
      </div>

      <div className="page-section">
        <h1>Usage report</h1>
        <div className="row" style={{ marginBottom: 'var(--space-4)' }}>
          <TextField
            label="From"
            type="date"
            value={usageFrom}
            onChange={(e) => setUsageFrom(e.target.value)}
          />
          <TextField
            label="To"
            type="date"
            value={usageTo}
            onChange={(e) => setUsageTo(e.target.value)}
          />
          <Button variant="secondary" onClick={() => setUsageKey((k) => k + 1)}>
            Refresh
          </Button>
        </div>
        {usageResource.loading ? (
          <LoadingState label="Crunching usage…" />
        ) : usageResource.error ? (
          <ErrorState message={usageResource.error} onRetry={usageResource.retry} />
        ) : (
          <Table
            columns={usageColumns}
            rows={usageResource.data?.rooms ?? []}
            rowKey={(u) => u.room.id}
            emptyMessage="No usage in this period"
          />
        )}
      </div>

      <Modal
        open={editing !== null}
        title={editing?.id ? 'Edit room' : 'Add room'}
        onClose={() => setEditing(null)}
      >
        {editing && (
          <form onSubmit={saveRoom} noValidate>
            <div className="stack">
              <TextField
                label="Name"
                value={editing.name}
                error={formErrors.name}
                onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              />
              <TextField
                label="Capacity (1–100)"
                type="number"
                min={1}
                max={100}
                value={editing.capacity}
                error={formErrors.capacity}
                onChange={(e) => setEditing({ ...editing, capacity: Number(e.target.value) })}
              />
              <TextField
                label="Floor (1–30)"
                type="number"
                min={1}
                max={30}
                value={editing.floor}
                error={formErrors.floor}
                onChange={(e) => setEditing({ ...editing, floor: Number(e.target.value) })}
              />
              <div>
                <p className="field__label">Features</p>
                <div className="row">
                  {ROOM_FEATURES.map((f) => (
                    <label key={f} className="row" style={{ gap: 'var(--space-1)' }}>
                      <input
                        type="checkbox"
                        checked={editing.features.includes(f)}
                        onChange={() => featureToggle(f)}
                      />
                      {f}
                    </label>
                  ))}
                </div>
              </div>
              <div className="form-actions">
                <Button variant="secondary" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving}>
                  {editing.id ? 'Save changes' : 'Create room'}
                </Button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
}
