/** RoomGrid — date picker, rooms × hourly slots grid, click empty slot → prefilled booking form. */
import { useState } from 'react';
import type { Room } from '@deskboard/shared';
import { api } from '../api/client.js';
import { useFetch } from '../hooks/useFetch.js';
import { SLOT_HOURS, pad2, todayKey } from '../lib/slots.js';
import { Modal } from '../components/ui/Modal.js';
import { BookingForm, type BookingFormPrefs } from '../components/BookingForm.js';
import { Button } from '../components/ui/Button.js';
import { SkeletonRows } from '../components/ui/Spinner.js';

export function RoomGridPage() {
  const [date, setDate] = useState(todayKey());
  const [prefs, setPrefs] = useState<BookingFormPrefs | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const roomsState = useFetch(() => api.listRooms(), []);
  const availabilityStates = useAvailability(roomsState.data ?? [], date);

  const rooms = roomsState.data ?? [];
  const anyLoading = roomsState.loading || availabilityStates.loading;
  const loadError = roomsState.error ?? availabilityStates.error;

  function openBooking(room: Room, time: string) {
    setPrefs({ roomId: room.id, date, startTime: time });
    setModalOpen(true);
  }

  return (
    <section aria-label="Room grid">
      <div className="form-row" style={{ marginBottom: 'var(--space-4)', alignItems: 'end' }}>
        <label className="field" htmlFor="grid-date">
          <span className="field__label">Date</span>
          <input
            id="grid-date"
            className="field__input"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayKey())}
            style={{ maxWidth: 200 }}
          />
        </label>
        {loadError && (
          <Button variant="secondary" onClick={() => { roomsState.reload(); availabilityStates.reload(); }}>
            Retry
          </Button>
        )}
      </div>

      {anyLoading && <SkeletonRows rows={4} />}

      {!anyLoading && loadError && (
        <div className="state-panel state-panel--error" role="alert">
          <p>Could not load the room grid: {loadError}</p>
        </div>
      )}

      {!anyLoading && !loadError && rooms.length === 0 && (
        <div className="state-panel">
          <p>No rooms yet — an admin needs to add rooms first.</p>
        </div>
      )}

      {!anyLoading && !loadError && rooms.length > 0 && (
        <div className="room-grid" role="table" aria-label="Room availability">
          <div className="room-grid__row" role="row">
            <div className="room-grid__corner" role="columnheader">
              Room
            </div>
            {SLOT_HOURS.map((hour) => (
              <div className="room-grid__hour" role="columnheader" key={hour}>
                {pad2(hour)}:00
              </div>
            ))}
          </div>
          {rooms.map((room) => {
            const grid = availabilityStates.data?.get(room.id);
            return (
              <div className="room-grid__row" role="row" key={room.id}>
                <div className="room-grid__room-name" role="rowheader">
                  {room.name}
                  <br />
                  <span style={{ fontWeight: 400, fontSize: 'var(--text-xs)' }}>
                    {room.active ? `up to ${room.capacity}` : 'deactivated'}
                  </span>
                </div>
                {SLOT_HOURS.map((hour) => {
                  const slot = grid?.slots.find((s: { time: string }) => s.time === `${pad2(hour)}:00`);
                  const booked = Boolean(slot?.bookingId);
                  const disabled = !room.active || booked;
                  const title = booked
                    ? `${slot?.bookingTitle} (${pad2(hour)}:00)`
                    : room.active
                      ? `Book ${room.name} at ${pad2(hour)}:00`
                      : `${room.name} is deactivated`;
                  return (
                    <button
                      key={hour}
                      type="button"
                      role="gridcell"
                      className={`room-grid__cell${booked ? ' room-grid__cell--booked' : ''}`}
                      disabled={disabled}
                      title={title}
                      aria-label={title}
                      onClick={() => openBooking(room, `${pad2(hour)}:00`)}
                    >
                      {booked ? slot?.bookingTitle : ''}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={modalOpen}
        title="New booking"
        onClose={() => setModalOpen(false)}
      >
        <BookingForm
          rooms={rooms}
          prefs={prefs}
          onClose={() => setModalOpen(false)}
          onBooked={() => availabilityStates.reload()}
        />
      </Modal>
    </section>
  );
}

/** Loads the availability grid for every room in parallel. */
function useAvailability(rooms: Room[], date: string) {
  const gridsKey = rooms.map((r) => r.id).join(',');
  const [nonce, setNonce] = useState(0);
  const reload = () => setNonce((n) => n + 1);

  const state = useFetch(async () => {
    const entries = await Promise.all(
      rooms.map(async (room) => {
        const grid = await api.availability(room.id, date);
        return [room.id, grid] as const;
      }),
    );
    return new Map(entries);
  }, [gridsKey, date, nonce]);

  return { ...state, reload };
}
