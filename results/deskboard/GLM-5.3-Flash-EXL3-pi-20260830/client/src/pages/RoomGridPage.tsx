/**
 * RoomGrid (home): rooms × hourly slots (08:00–19:00) for a date.
 * Clicking an empty slot opens the prefilled booking form.
 */
import { useMemo } from 'react';
import type { AvailabilitySlot, Room } from 'deskboard-shared';
import { api } from '../api/client.js';
import { useResource } from '../hooks/useResource.js';
import { formatDateHuman, gridSlotStarts, todayIso } from '../logic/slots.js';
import { ErrorState, LoadingState } from '../components/States.js';
import { TextField } from '../components/ui/TextField.js';
import { Badge } from '../components/ui/Badge.js';

interface GridRow {
  room: Room;
  slots: AvailabilitySlot[];
}

export function RoomGridPage({
  date,
  onDateChange,
  onSlotClick
}: {
  date: string;
  onDateChange: (date: string) => void;
  onSlotClick: (roomId: string, slotStart: string) => void;
}) {
  const roomsResource = useResource(() => api.rooms(), []);

  const dateParam = date || todayIso();

  // Load availability for every active room, then zip into grid rows.
  const gridResource = useResource<GridRow[]>(async () => {
    const rooms = await api.rooms();
    const active = rooms.filter((r) => r.active);
    const grids = await Promise.all(active.map((r) => api.availability(r.id, dateParam)));
    const byRoom = new Map(grids.map((g) => [g.roomId, g.slots]));
    return active.map((room) => ({ room, slots: byRoom.get(room.id) ?? [] }));
  }, [dateParam]);

  const slotStarts = useMemo(() => gridSlotStarts(), []);

  if (roomsResource.loading || gridResource.loading) {
    return (
      <LoadingState label="Loading room grid…" />
    );
  }
  if (roomsResource.error) {
    return <ErrorState message={roomsResource.error} onRetry={roomsResource.retry} />;
  }
  if (gridResource.error) {
    return <ErrorState message={gridResource.error} onRetry={gridResource.retry} />;
  }

  const rows = gridResource.data ?? [];

  return (
    <div className="page-section">
      <div className="section-header">
        <h1>Rooms — {formatDateHuman(dateParam)}</h1>
        <TextField
          label="Date"
          type="date"
          value={dateParam}
          min=""
          onChange={(e) => onDateChange(e.target.value)}
        />
      </div>
      {rows.length === 0 ? (
        <div className="state">
          <p className="state__title">No rooms yet</p>
          <p>Ask an admin to add rooms before booking.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table className="room-grid">
            <caption className="muted" style={{ textAlign: 'left', marginBottom: 'var(--space-2)' }}>
              Click an empty slot to book it
            </caption>
            <thead>
              <tr>
                <th scope="col">Room</th>
                {slotStarts.map((s) => (
                  <th key={s} scope="col">
                    {s}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ room, slots }) => (
                <tr key={room.id}>
                  <th scope="row">
                    {room.name}
                    <br />
                    <span className="muted">
                      floor {room.floor} · {room.capacity} seats
                    </span>{' '}
                    {room.features.map((f) => (
                      <Badge key={f} variant="info">
                        {f}
                      </Badge>
                    ))}
                  </th>
                  {slotStarts.map((s) => {
                    const slot = slots.find((slot) => slot.start === s);
                    if (!slot || slot.available) {
                      return (
                        <td key={s}>
                          <button
                            type="button"
                            className="room-grid__slot"
                            style={{
                              width: '100%',
                              background: 'var(--color-surface)',
                              border: '1px dashed var(--color-border-strong)',
                              borderRadius: 'var(--radius-sm)',
                              cursor: 'pointer'
                            }}
                            aria-label={`Book ${room.name} at ${s}`}
                            onClick={() => onSlotClick(room.id, s)}
                          >
                            ＋
                          </button>
                        </td>
                      );
                    }
                    return (
                      <td key={s} className="room-grid__slot room-grid__slot--busy" title={slot.bookingTitle}>
                        {slot.bookingTitle}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
