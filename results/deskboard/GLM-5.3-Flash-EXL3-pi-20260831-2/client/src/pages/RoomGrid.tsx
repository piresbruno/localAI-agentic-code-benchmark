import { Room } from '@deskboard/shared';
import { useState } from 'react';
import { api } from '../api/client';
import { TextField } from '../components/ui/TextField';
import { useAsync } from '../hooks/useAsync';
import { buildRoomRows, GridSlot, todayLocal } from '../lib/slots';
import { DataView } from './DataView';

export interface BookingPrefill {
  roomId: string;
  date: string;
  start?: string;
}

/** Home view: rooms × hourly slots (08:00–19:00) for a chosen local date. */
export function RoomGrid({ onBook }: { onBook: (prefill: BookingPrefill) => void }) {
  const [date, setDate] = useState(todayLocal);

  const { data, loading, error, retry } = useAsync(
    async () => {
      const rooms = await api.listRooms();
      const active = rooms.filter((room) => room.active);
      const grids = await Promise.all(active.map((room) => api.availability(room.id, date)));
      return { rooms: active, grids };
    },
    [date],
  );

  const rows = data ? buildRoomRows(data.rooms, data.grids) : [];

  return (
    <section aria-labelledby="grid-heading">
      <div className="page-head">
        <h1 id="grid-heading">Room availability</h1>
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => e.target.value && setDate(e.target.value)}
          className="date-picker"
        />
      </div>

      <DataView
        loading={loading}
        error={error}
        retry={retry}
        isEmpty={rows.length === 0}
        empty={
          <div className="data-empty">
            <p>No bookable rooms for this day yet — ask an admin to add rooms.</p>
          </div>
        }
      >
        <div className="grid-scroll" role="region" aria-label="Availability grid" tabIndex={0}>
          <table className="table booking-grid">
            <thead>
              <tr>
                <th scope="col">Room</th>
                {rows[0]?.slots.map((slot) => (
                  <th key={slot.start} scope="col" className="slot-head">
                    {slot.start}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.room.id}>
                  <th scope="row" className="room-name">
                    {row.room.name}
                    <span className="muted room-meta">
                      floor {row.room.floor} · {row.room.capacity} people
                    </span>
                  </th>
                  {row.slots.map((slot) => (
                    <SlotCell
                      key={slot.start}
                      room={row.room}
                      slot={slot}
                      onPick={() => onBook({ roomId: row.room.id, date, start: slot.start })}
                    />
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataView>
    </section>
  );
}

function SlotCell({ room, slot, onPick }: { room: Room; slot: GridSlot; onPick: () => void }) {
  if (slot.available) {
    return (
      <td className="slot slot-free">
        <button
          type="button"
          className="slot-button"
          onClick={onPick}
          aria-label={`Book ${room.name} at ${slot.start}`}
          title={`Book ${room.name} at ${slot.start}`}
        >
          +
        </button>
      </td>
    );
  }
  return (
    <td className="slot slot-busy" title={slot.title}>
      <span className="slot-title">{slot.title ?? 'Booked'}</span>
    </td>
  );
}
