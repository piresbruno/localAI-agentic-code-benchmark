import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import type { AvailabilityResponse, Room } from 'shared';
import { roomsApi } from '../api/endpoints';
import { useAsync } from '../hooks/useAsync';
import {
  Badge,
  bookingStatusTone,
  bookingStatusLabel,
  roomStatusTone,
} from '../components/ui/Badge';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { HOURS, formatHour, toLocalDateString, isActive } from '../logic/booking';

export function RoomGridPage() {
  const [date, setDate] = useState(toLocalDateString(new Date()));
  const navigate = useNavigate();

  const { data, loading, error, reload } = useAsync(async () => {
    const rooms = await roomsApi.list();
    const availabilities = await Promise.all(
      rooms.filter(isActive).map((room) => roomsApi.availability(room.id, date)),
    );
    return {
      rooms: rooms.filter(isActive),
      availabilityByRoom: new Map<string, AvailabilityResponse>(
        availabilities.map((a) => [a.roomId, a]),
      ),
    };
  }, [date]);

  const hours = useMemo(() => HOURS, []);

  return (
    <section>
      <div className="toolbar">
        <h1 className="page-title">Rooms — {date}</h1>
        <label className="toolbar-date" htmlFor="grid-date">
          <span className="visually-hidden">Date</span>
          <input
            id="grid-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="field-input"
          />
        </label>
      </div>

      {loading ? <LoadingState label="Loading room grid…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data && !loading ? (
        data.rooms.length === 0 ? (
          <EmptyState
            title="No active rooms yet"
            action={
              <Link className="btn btn-primary" to="/admin/rooms">
                Add a room
              </Link>
            }
          />
        ) : (
          <div className="grid-scroll">
            <table className="room-grid">
              <thead>
                <tr>
                  <th scope="col" className="room-col">
                    Room
                  </th>
                  {hours.map((hour) => (
                    <th key={hour} scope="col">
                      {formatHour(hour)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rooms.map((room: Room) => {
                  const availability = data.availabilityByRoom.get(room.id);
                  return (
                    <tr key={room.id}>
                      <th scope="row" className="room-cell">
                        <span className="room-name">{room.name}</span>
                        <span className="room-meta">
                          Floor {room.floor} · {room.capacity} seats
                        </span>
                        <Badge tone={roomStatusTone(room.active)}>
                          {room.active ? 'Active' : 'Inactive'}
                        </Badge>
                      </th>
                      {hours.map((hour) => {
                        const slot = availability?.slots.find(
                          (s) => new Date(s.start).getHours() === hour,
                        );
                        if (!slot) {
                          return (
                            <td key={hour} className="grid-cell">
                              <span className="grid-slot">—</span>
                            </td>
                          );
                        }
                        const free = slot.status === 'free';
                        return (
                          <td key={hour} className="grid-cell">
                            {free ? (
                              <button
                                type="button"
                                className="grid-slot grid-slot-free"
                                aria-label={`Book ${room.name} at ${formatHour(hour)}`}
                                onClick={() =>
                                  navigate(
                                    `/bookings/new?room=${room.id}&date=${date}&start=${formatHour(hour)}`,
                                  )
                                }
                              >
                                +
                              </button>
                            ) : (
                              <div className="grid-slot grid-slot-busy" aria-label="Busy">
                                {slot.bookings.map((b) => (
                                  <span key={b.id} className="grid-booking" title={b.title}>
                                    <Badge tone={bookingStatusTone(b.status)}>
                                      {bookingStatusLabel(b.status)}
                                    </Badge>
                                    <span className="grid-booking-title">{b.title}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )
      ) : null}
    </section>
  );
}
