import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { AvailabilityDto, RoomDto } from '@deskboard/shared';
import { api } from '../api/client';
import { useResource, todayIso } from '../hooks/useResource';
import { buildGrid, hhmm } from '../lib/slots';
import { TextField } from '../components/ui/TextField';
import { EmptyState, ErrorState, GridSkeleton } from '../components/States';

/** Home page: rooms × hourly slots (08:00–19:00) for one day; empty slot click prefills the form. */
export function RoomGrid() {
  const navigate = useNavigate();
  const [date, setDate] = useState(todayIso());

  const grid = useResource(async () => {
    const rooms: RoomDto[] = await api.rooms();
    const active = rooms.filter((r) => r.active);
    const availability: AvailabilityDto[] = await Promise.all(active.map((r) => api.availability(r.id, date)));
    return buildGrid(active, availability);
  }, [date]);

  return (
    <>
      <h1 className="page-title">Room availability</h1>
      <p className="page-subtitle">Pick a free slot to create a booking. Bookings run Mon–Fri, 08:00–19:00.</p>

      <div className="grid-toolbar">
        <TextField
          label="Date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          style={{ marginBottom: 0 }}
        />
      </div>

      {grid.loading ? (
        <GridSkeleton />
      ) : grid.error ? (
        <ErrorState message={grid.error} onRetry={grid.retry} />
      ) : (grid.data ?? []).length === 0 ? (
        <EmptyState title="No active rooms right now">Ask an admin to add rooms in the admin panel.</EmptyState>
      ) : (
        <div className="grid-scroll">
          <table className="room-grid">
            <thead>
              <tr>
                <th scope="col">Room</th>
                {Array.from({ length: 11 }, (_, i) => (
                  <th key={i} scope="col">
                    {hhmm(8 + i)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(grid.data ?? []).map((row) => (
                <tr key={row.room.id}>
                  <th scope="row" className="room-grid__room">
                    {row.room.name}
                    <div style={{ fontWeight: 400, color: 'var(--color-text-muted)' }}>
                      floor {row.room.floor} · {row.room.capacity} seats
                    </div>
                  </th>
                  {row.cells.map((cell, i) => (
                    <td key={i} className="room-grid__cell">
                      {cell.kind === 'busy' ? (
                        <span className="room-grid__booking" title={cell.booking!.title}>
                          {cell.booking!.title}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="room-grid__slot"
                          aria-label={`Book ${row.room.name} at ${hhmm(8 + i)}`}
                          onClick={() =>
                            navigate(`/book?roomId=${row.room.id}&date=${date}&start=${hhmm(8 + i)}`)
                          }
                        >
                          ＋
                        </button>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="room-grid__legend">
        <span>
          <span className="legend-swatch legend-swatch--free" /> free — click ＋ to book
        </span>
        <span>
          <span className="legend-swatch legend-swatch--busy" /> booked
        </span>
      </div>
    </>
  );
}
