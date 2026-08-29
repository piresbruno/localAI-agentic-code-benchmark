import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Feature, Room } from 'shared';
import { FEATURES, roomCreateSchema, formatZodErrors } from 'shared';
import type { ZodError } from 'zod';
import { adminApi, roomsApi } from '../api/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/ui/Toast';
import { Badge, roomStatusTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { TextField } from '../components/ui/TextField';
import { Modal } from '../components/ui/Modal';
import { Table } from '../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { featureLabel, toLocalDateString } from '../logic/booking';

interface RoomDraft {
  name: string;
  capacity: string;
  floor: string;
  features: Feature[];
}

const emptyDraft = (): RoomDraft => ({ name: '', capacity: '8', floor: '1', features: [] });

function toDraft(room: Room): RoomDraft {
  return {
    name: room.name,
    capacity: String(room.capacity),
    floor: String(room.floor),
    features: [...room.features],
  };
}

export function AdminRoomsPage() {
  const toast = useToast();
  const roomsQuery = useAsync(roomsApi.list, []);
  const [usageFrom, setUsageFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toLocalDateString(d);
  });
  const [usageTo, setUsageTo] = useState(toLocalDateString(new Date()));
  const usageQuery = useAsync(() => adminApi.usage(usageFrom, usageTo), [usageFrom, usageTo]);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [draft, setDraft] = useState<RoomDraft>(emptyDraft());
  const [draftErrors, setDraftErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deactivatingId, setDeactivatingId] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setDraft(emptyDraft());
    setDraftErrors({});
    setModalOpen(true);
  }

  function openEdit(room: Room) {
    setEditing(room);
    setDraft(toDraft(room));
    setDraftErrors({});
    setModalOpen(true);
  }

  function toggleFeature(feature: Feature) {
    setDraft((d) => ({
      ...d,
      features: d.features.includes(feature)
        ? d.features.filter((f) => f !== feature)
        : [...d.features, feature],
    }));
  }

  async function saveRoom(event: FormEvent) {
    event.preventDefault();
    setDraftErrors({});
    const parsed = roomCreateSchema.safeParse({
      name: draft.name,
      capacity: Number(draft.capacity),
      floor: Number(draft.floor),
      features: draft.features,
    });
    if (!parsed.success) {
      setDraftErrors(formatZodErrors(parsed.error as ZodError));
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await roomsApi.update(editing.id, parsed.data);
        toast.push('success', 'Room updated');
      } else {
        await roomsApi.create(parsed.data);
        toast.push('success', 'Room created');
      }
      setModalOpen(false);
      roomsQuery.reload();
      usageQuery.reload();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not save room');
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(room: Room) {
    setDeactivatingId(room.id);
    try {
      await roomsApi.deactivate(room.id);
      toast.push('success', `${room.name} deactivated — new bookings blocked`);
      roomsQuery.reload();
      usageQuery.reload();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not deactivate room');
    } finally {
      setDeactivatingId(null);
    }
  }

  return (
    <section>
      <div className="toolbar">
        <h1 className="page-title">Rooms & usage</h1>
        <Button onClick={openCreate}>Add room</Button>
      </div>

      {roomsQuery.loading ? <LoadingState label="Loading rooms…" /> : null}
      {roomsQuery.error ? (
        <ErrorState message={roomsQuery.error} onRetry={roomsQuery.reload} />
      ) : null}

      {roomsQuery.data && !roomsQuery.loading ? (
        roomsQuery.data.length === 0 ? (
          <EmptyState
            title="No rooms yet"
            action={<Button onClick={openCreate}>Add the first room</Button>}
          />
        ) : (
          <Table
            caption="All rooms (admin)"
            headers={['Name', 'Floor', 'Capacity', 'Features', 'Status', '']}
            emptyMessage="No rooms"
          >
            {roomsQuery.data.map((room) => (
              <tr key={room.id}>
                <td>{room.name}</td>
                <td>{room.floor}</td>
                <td>{room.capacity}</td>
                <td>{room.features.length ? room.features.map(featureLabel).join(', ') : '—'}</td>
                <td>
                  <Badge tone={roomStatusTone(room.active)}>
                    {room.active ? 'Active' : 'Inactive'}
                  </Badge>
                </td>
                <td>
                  <div className="table-actions">
                    <Button variant="secondary" size="sm" onClick={() => openEdit(room)}>
                      Edit
                    </Button>
                    {room.active ? (
                      <Button
                        variant="danger"
                        size="sm"
                        loading={deactivatingId === room.id}
                        onClick={() => deactivate(room)}
                      >
                        Deactivate
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </Table>
        )
      ) : null}

      <h2 className="section-title">Usage report</h2>
      <form
        className="toolbar"
        onSubmit={(e) => {
          e.preventDefault();
          usageQuery.reload();
        }}
      >
        <label className="field-inline" htmlFor="usage-from">
          From
          <input
            id="usage-from"
            type="date"
            className="field-input"
            value={usageFrom}
            onChange={(e) => setUsageFrom(e.target.value)}
          />
        </label>
        <label className="field-inline" htmlFor="usage-to">
          To
          <input
            id="usage-to"
            type="date"
            className="field-input"
            value={usageTo}
            onChange={(e) => setUsageTo(e.target.value)}
          />
        </label>
        <Button type="submit" variant="secondary">
          Refresh
        </Button>
      </form>

      {usageQuery.loading ? <LoadingState label="Loading usage…" /> : null}
      {usageQuery.error ? (
        <ErrorState message={usageQuery.error} onRetry={usageQuery.reload} />
      ) : null}

      {usageQuery.data && !usageQuery.loading ? (
        <Table
          caption={`Usage ${usageQuery.data.from} → ${usageQuery.data.to}`}
          headers={['Room', 'Booked hours', '# bookings', 'Top organizer']}
          emptyMessage="No usage data"
        >
          {usageQuery.data.rooms.map((row) => (
            <tr key={row.roomId}>
              <td>{row.roomName}</td>
              <td>{row.bookedHours}</td>
              <td>{row.bookings}</td>
              <td>
                {row.topOrganizer
                  ? `${row.topOrganizer.email} (${row.topOrganizer.bookings})`
                  : '—'}
              </td>
            </tr>
          ))}
        </Table>
      ) : null}

      <Modal
        open={modalOpen}
        title={editing ? `Edit ${editing.name}` : 'Add room'}
        onClose={() => setModalOpen(false)}
        aria-label={editing ? `Edit room ${editing.name}` : 'Add a room'}
      >
        <form onSubmit={saveRoom} noValidate>
          <TextField
            label="Name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            error={draftErrors.name}
            autoFocus
          />
          <div className="field-row">
            <TextField
              label="Capacity"
              type="number"
              min={1}
              max={100}
              value={draft.capacity}
              onChange={(e) => setDraft((d) => ({ ...d, capacity: e.target.value }))}
              error={draftErrors.capacity}
            />
            <TextField
              label="Floor"
              type="number"
              min={1}
              max={30}
              value={draft.floor}
              onChange={(e) => setDraft((d) => ({ ...d, floor: e.target.value }))}
              error={draftErrors.floor}
            />
          </div>
          <fieldset className="feature-group">
            <legend className="field-label">Features</legend>
            {FEATURES.map((feature) => (
              <label key={feature} className="feature-check">
                <input
                  type="checkbox"
                  checked={draft.features.includes(feature)}
                  onChange={() => toggleFeature(feature)}
                />
                {featureLabel(feature)}
              </label>
            ))}
          </fieldset>
          {draftErrors.features ? (
            <p className="field-error" role="alert">
              {draftErrors.features}
            </p>
          ) : null}
          <div className="form-actions">
            <Button type="submit" loading={saving}>
              {editing ? 'Save changes' : 'Create room'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
          </div>
        </form>
      </Modal>
    </section>
  );
}
