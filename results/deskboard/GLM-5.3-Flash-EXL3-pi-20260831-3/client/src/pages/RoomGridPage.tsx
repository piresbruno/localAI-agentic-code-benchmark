import { useCallback, useMemo } from 'react';
import type { BookingDto, Room } from '@deskboard/shared';
import { api } from '../api/client.js';
import { DataState } from '../components/DataState.js';
import { useApiData } from '../hooks/useApiData.js';
import { buildGrid, toDateKey, type GridSlot, type RoomWithSlots } from '../lib/slots.js';

interface RoomGridProps {
  date: string;
  onDateChange: (date: string) => void;
  /** Click on an empty, bookable slot → open the booking form prefilled. */
  onBookSlot: (roomId: string, date: string, startTime: string) => void;
  onGridChanged: () => void;
  refreshKey: number;
}

/** Home view: rooms × hourly slots 08:00–19:00 for the chosen date. */
export function RoomGridPage({
  date,
  onDateChange,
  onBookSlot,
  onGridChanged,
  refreshKey,
}: RoomGridProps) {
  const fetcher = useCallback(async () => {
    const rooms = await api.get<Room[]>('/rooms');
    const bookings = await api.get<BookingDto[]>('/bookings/mine');
    return { rooms, bookings };
  }, []);

  const { data, loading, error, retry } = useApiData(fetcher);
  void refreshKey;
  void onGridChanged;

  const grid = useMemo<RoomWithSlots[]>(
    () => (data ? buildGrid(data.rooms, data.bookings, date) : []),
    [data, date],
  );

  return (
    <main className="container">
      <h1 className="page-title">Room availability</h1>
      <div className="grid-toolbar">
        <label className="field-label" htmlFor="grid-date">
          Date
        </label>
        <input
          id="grid-date"
          type="date"
          className="field-input"
          value={date}
          onChange={(e) => onDateChange(e.target.value || toDateKey(new Date()))}
        />
      </div>

      <DataState
        loading={loading}
        error={error}
        empty={grid.length === 0}
        emptyContent={
          <p>No rooms available yet — ask an admin to add rooms, or come back later.</p>
        }
        onRetry={retry}
      >
        <p className="muted">
          Pick a free slot to start a booking. Times are 08:00–19:00, Monday to Friday.
        </p>
        <div className="grid-scroll">
          <div className="room-grid" role="table" aria-label="Room availability grid">
            <div className="room-grid-row" role="row">
              <div className="room-grid-head" role="columnheader">
                Room
              </div>
              {grid[0]?.slots.map((slot) => (
                <div key={slot.start} className="room-grid-head" role="columnheader">
                  {slot.start}
                </div>
              ))}
            </div>
            {grid.map(({ room, slots }) => (
              <GridRow
                key={room.id}
                room={room}
                slots={slots}
                onBookSlot={(startTime) => onBookSlot(room.id, date, startTime)}
              />
            ))}
          </div>
        </div>
      </DataState>
    </main>
  );
}

function GridRow({
  room,
  slots,
  onBookSlot,
}: {
  room: Room;
  slots: GridSlot[];
  onBookSlot: (startTime: string) => void;
}) {
  return (
    <div className="room-grid-row" role="row">
      <div className="room-grid-room" role="rowheader">
        <span>{room.name}</span>
        <span className="muted">
          Floor {room.floor} · {room.capacity} people
        </span>
        {!room.active && <span className="status-chip status-chip--cancelled">deactivated</span>}
      </div>
      {slots.map((slot) => (
        <SlotCell key={slot.start} slot={slot} room={room} onBookSlot={onBookSlot} />
      ))}
    </div>
  );
}

function SlotCell({
  slot,
  room,
  onBookSlot,
}: {
  slot: GridSlot;
  room: Room;
  onBookSlot: (startTime: string) => void;
}) {
  if (slot.booking) {
    return (
      <div
        className="slot slot--busy"
        role="cell"
        title={`${slot.booking.title} (${slot.booking.start.slice(11)}–${slot.booking.end.slice(11)})`}
      >
        <strong>{slot.booking.title}</strong>
        <span className="muted">{slot.booking.attendees} ppl</span>
      </div>
    );
  }
  if (!slot.bookable || !room.active) {
    return (
      <div className="slot slot--offhours" role="cell" aria-label={`${slot.start} unavailable`} />
    );
  }
  return (
    <button
      type="button"
      className="slot slot--bookable"
      role="cell"
      onClick={() => onBookSlot(slot.start)}
      aria-label={`Book ${room.name} at ${slot.start}`}
    >
      +
    </button>
  );
}
