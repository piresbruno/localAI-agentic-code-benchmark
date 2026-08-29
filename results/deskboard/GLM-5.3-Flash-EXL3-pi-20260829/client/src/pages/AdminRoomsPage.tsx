/** AdminRooms — room table with add/edit modal, deactivate, and the usage report table. */
import { useState, type FormEvent } from 'react';
import { ROOM_FEATURES, type Room, type RoomFeature, type UsageReportEntry } from '@deskboard/shared';
import { ApiClientError, api } from '../api/client.js';
import { useFetch } from '../hooks/useFetch.js';
import { formatMinutes, todayKey } from '../lib/slots.js';
import { Button } from '../components/ui/Button.js';
import { FeatureTag } from '../components/ui/Badge.js';
import { Modal } from '../components/ui/Modal.js';
import { Table } from '../components/ui/Table.js';
import { TextField } from '../components/ui/TextField.js';
import { SkeletonRows } from '../components/ui/Spinner.js';
import { useToast } from '../components/ui/Toast.js';

interface RoomDraft {
  id: string | null;
  name: string;
  capacity: string;
  floor: string;
  features: RoomFeature[];
  active: boolean;
}

const emptyDraft: RoomDraft = { id: null, name: '', capacity: '6', floor: '1', features: [], active: true };

export function AdminRoomsPage() {
  const toast = useToast();
  const roomsState = useFetch(() => api.listRooms(), []);
  const rooms = roomsState.data ?? [];

  const weekAgo = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000);
  const defaultFrom = `${weekAgo.getFullYear()}-${String(weekAgo.getMonth() + 1).padStart(2, '0')}-${String(weekAgo.getDate()).padStart(2, '0')}`;
  const [from, setFrom] = useState(defaultFrom);
  const [to, setTo] = useState(todayKey());
  const usageState = useFetch(() => api.usage(from, to), [from, to]);

  const [draft, setDraft] = useState<RoomDraft | null>(null);
  const [busy, setBusy] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  function openCreate() {
    setFieldErrors({});
    setFormError(null);
    setDraft({ ...emptyDraft });
  }

  function openEdit(room: Room) {
    setFieldErrors({});
    setFormError(null);
    setDraft({
      id: room.id,
      name: room.name,
      capacity: String(room.capacity),
      floor: String(room.floor),
      features: [...room.features],
      active: room.active,
    });
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!draft) return;
    setBusy(true);
    setFieldErrors({});
    setFormError(null);
    const payload = {
      name: draft.name,
      capacity: Number(draft.capacity),
      floor: Number(draft.floor),
      features: draft.features,
      active: draft.active,
    };
    try {
      if (draft.id) {
        await api.updateRoom(draft.id, payload);
        toast.showToast('Room updated');
      } else {
        await api.createRoom(payload);
        toast.showToast('Room created');
      }
      setDraft(null);
      roomsState.reload();
    } catch (err) {
      handleRoomError(err);
    } finally {
      setBusy(false);
    }
  }

  function handleRoomError(err: unknown) {
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
  }

  async function handleDeactivate(room: Room) {
    setBusy(true);
    try {
      await api.deactivateRoom(room.id);
      toast.showToast(`${room.name} deactivated`);
      roomsState.reload();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Could not deactivate room', 'error');
    } finally {
      setBusy(false);
    }
  }

  function toggleFeature(feature: RoomFeature) {
    setDraft((current) =>
      current
        ? {
            ...current,
            features: current.features.includes(feature)
              ? current.features.filter((f) => f !== feature)
              : [...current.features, feature],
          }
        : current,
    );
  }

  return (
    <section aria-label="Admin rooms and usage">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-4)' }}>
        <h2 className="section-title" style={{ margin: 0 }}>
          Rooms
        </h2>
        <Button onClick={openCreate}>Add room</Button>
      </div>

      {roomsState.loading && <SkeletonRows rows={3} />}
      {!roomsState.loading && roomsState.error && (
        <div className="state-panel state-panel--error" role="alert">
          <p>Could not load rooms: {roomsState.error}</p>
          <div className="state-panel__actions">
            <Button variant="secondary" onClick={roomsState.reload}>
              Retry
            </Button>
          </div>
        </div>
      )}
      {!roomsState.loading && !roomsState.error && (
        <Table columns={['Name', 'Floor', 'Capacity', 'Features', 'Status', 'Actions']} emptyMessage="No rooms yet — add the first one.">
          {rooms.map((room) => (
            <tr key={room.id}>
              <td>{room.name}</td>
              <td>{room.floor}</td>
              <td>{room.capacity}</td>
              <td>
                {room.features.length > 0 ? (
                  room.features.map((f) => <FeatureTag key={f} feature={f} />)
                ) : (
                  <span style={{ color: 'var(--color-text-muted)' }}>—</span>
                )}
              </td>
              <td>
                <span className={`badge ${room.active ? 'badge--confirmed' : 'badge--cancelled'}`}>
                  {room.active ? '✓ Active' : '✕ Deactivated'}
                </span>
              </td>
              <td style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="secondary" onClick={() => openEdit(room)} disabled={busy}>
                  Edit
                </Button>
                {room.active && (
                  <Button variant="danger" onClick={() => handleDeactivate(room)} disabled={busy}>
                    Deactivate
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      )}

      <Modal
        open={draft !== null}
        title={draft?.id ? 'Edit room' : 'Add room'}
        onClose={() => setDraft(null)}
      >
        {draft && (
          <form className="form" onSubmit={handleSave} aria-label={draft.id ? 'Edit room' : 'Add room'}>
            <TextField
              label="Name"
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
              disabled={busy}
              required
              error={fieldErrors.name}
            />
            <div className="form-row">
              <TextField
                label="Capacity (1–100)"
                type="number"
                value={draft.capacity}
                onChange={(capacity) => setDraft({ ...draft, capacity })}
                disabled={busy}
                required
                error={fieldErrors.capacity}
              />
              <TextField
                label="Floor (1–30)"
                type="number"
                value={draft.floor}
                onChange={(floor) => setDraft({ ...draft, floor })}
                disabled={busy}
                required
                error={fieldErrors.floor}
              />
            </div>
            <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
              <legend className="field__label">Features</legend>
              <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                {ROOM_FEATURES.map((feature) => (
                  <label key={feature} style={{ fontSize: 'var(--text-sm)', display: 'flex', gap: 'var(--space-1)' }}>
                    <input
                      type="checkbox"
                      checked={draft.features.includes(feature)}
                      onChange={() => toggleFeature(feature)}
                      disabled={busy}
                    />
                    {feature}
                  </label>
                ))}
              </div>
            </fieldset>
            <label style={{ fontSize: 'var(--text-sm)', display: 'flex', gap: 'var(--space-2)' }}>
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(e) => setDraft({ ...draft, active: e.target.checked })}
                disabled={busy}
              />
              Active (bookable)
            </label>
            {formError && (
              <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 'var(--text-sm)', margin: 0 }}>
                {formError}
              </p>
            )}
            <div className="modal__actions" style={{ margin: 0 }}>
              <Button type="button" variant="secondary" onClick={() => setDraft(null)} disabled={busy}>
                Cancel
              </Button>
              <Button type="submit" loading={busy}>
                {draft.id ? 'Save changes' : 'Create room'}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      <h2 className="section-title">Usage report</h2>
      <div className="form-row" style={{ marginBottom: 'var(--space-4)', alignItems: 'end' }}>
        <TextField label="From" type="date" value={from} onChange={setFrom} />
        <TextField label="To" type="date" value={to} onChange={setTo} />
      </div>
      {usageState.loading && <SkeletonRows rows={3} />}
      {!usageState.loading && usageState.error && (
        <div className="state-panel state-panel--error" role="alert">
          <p>Could not load the usage report: {usageState.error}</p>
          <div className="state-panel__actions">
            <Button variant="secondary" onClick={usageState.reload}>
              Retry
            </Button>
          </div>
        </div>
      )}
      {!usageState.loading && !usageState.error && (
        <UsageTable entries={usageState.data ?? []} />
      )}
    </section>
  );
}

function UsageTable({ entries }: { entries: UsageReportEntry[] }) {
  if (entries.every((e) => e.bookingCount === 0)) {
    return (
      <div className="state-panel">
        <p>No bookings in this period — pick a wider date range.</p>
      </div>
    );
  }
  return (
    <Table columns={['Room', 'Bookings', 'Booked time', 'Top organizer']} emptyMessage="No usage data.">
      {entries.map((entry) => (
        <tr key={entry.roomId}>
          <td>{entry.roomName}</td>
          <td>{entry.bookingCount}</td>
          <td>{formatMinutes(entry.totalBookedMinutes)}</td>
          <td>{entry.topOrganizer ?? '—'}</td>
        </tr>
      ))}
    </Table>
  );
}
