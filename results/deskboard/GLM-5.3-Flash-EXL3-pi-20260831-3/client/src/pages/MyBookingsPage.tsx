import { useCallback } from 'react';
import type { BookingDto } from '@deskboard/shared';
import { api, ApiError } from '../api/client.js';
import { Button } from '../components/ui/Button.js';
import { DataState } from '../components/DataState.js';
import { useToast } from '../components/ui/Toast.js';
import { useApiData } from '../hooks/useApiData.js';
import { canCancel, cancelDisabledReason, splitUpcoming } from '../lib/slots.js';

/** My bookings: upcoming and past lists, cancel respecting the 1h window. */
export function MyBookingsPage({ onChanged }: { onChanged: () => void }) {
  const toast = useToast();
  const fetcher = useCallback(() => api.get<BookingDto[]>('/bookings/mine'), []);
  const { data, loading, error, retry } = useApiData(fetcher);

  async function cancelBooking(id: string) {
    try {
      await api.del<BookingDto>(`/bookings/${id}`);
      toast.success('Booking cancelled');
      retry(); // refetch
      onChanged();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : 'Something went wrong');
    }
  }

  const now = new Date();
  const bookings = data ?? [];
  const { upcoming, past } = splitUpcoming(bookings, now);

  return (
    <main className="container">
      <h1 className="page-title">My bookings</h1>
      <DataState
        loading={loading}
        error={error}
        empty={bookings.length === 0}
        emptyContent={
          <p>
            No bookings yet — pick a room on the <strong>Rooms</strong> page to get started.
          </p>
        }
        onRetry={retry}
      >
        <section aria-labelledby="upcoming-heading">
          <h2 className="section-title" id="upcoming-heading">
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <p className="muted">Nothing upcoming — pick a room on the Rooms page.</p>
          ) : (
            <ul className="booking-list">
              {upcoming.map((booking) => (
                <li key={booking.id} className="booking-card">
                  <div className="booking-card-main">
                    <strong>{booking.title}</strong>
                    <div className="muted">
                      {booking.roomName} · {booking.start.replace('T', ' ')} →{' '}
                      {booking.end.slice(11)} · {booking.attendees} people
                    </div>
                  </div>
                  <span className="status-chip status-chip--confirmed">
                    <span aria-hidden="true">✓</span> confirmed
                  </span>
                  <CancelButton
                    booking={booking}
                    now={now}
                    onCancel={() => cancelBooking(booking.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="past-heading">
          <h2 className="section-title" id="past-heading">
            Past &amp; cancelled
          </h2>
          {past.length === 0 ? (
            <p className="muted">No past bookings yet.</p>
          ) : (
            <ul className="booking-list">
              {past.map((booking) => (
                <li key={booking.id} className="booking-card">
                  <div className="booking-card-main">
                    <strong>{booking.title}</strong>
                    <div className="muted">
                      {booking.roomName} · {booking.start.replace('T', ' ')}
                    </div>
                  </div>
                  <span className={`status-chip status-chip--${booking.status}`}>
                    <span aria-hidden="true">{booking.status === 'cancelled' ? '✕' : '✔'}</span>{' '}
                    {booking.status}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </DataState>
    </main>
  );
}

function CancelButton({
  booking,
  now,
  onCancel,
}: {
  booking: BookingDto;
  now: Date;
  onCancel: () => void;
}) {
  const allowed = canCancel(booking, now);
  return (
    <span title={allowed ? undefined : cancelDisabledReason()}>
      <Button
        variant="danger"
        disabled={!allowed}
        onClick={onCancel}
        aria-label={`Cancel ${booking.title}`}
      >
        Cancel
      </Button>
    </span>
  );
}
