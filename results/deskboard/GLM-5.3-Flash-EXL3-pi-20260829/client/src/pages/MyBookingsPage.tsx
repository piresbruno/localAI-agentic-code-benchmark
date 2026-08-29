/** MyBookings — own upcoming/past bookings with cancel respecting the 1h window. */
import { useMemo, useState } from 'react';
import { api } from '../api/client.js';
import { useFetch } from '../hooks/useFetch.js';
import { canCancel, cancelDisabledReason, formatOccurrence } from '../lib/slots.js';
import { Button } from '../components/ui/Button.js';
import { StatusBadge } from '../components/ui/Badge.js';
import { SkeletonRows } from '../components/ui/Spinner.js';
import { useToast } from '../components/ui/Toast.js';

export function MyBookingsPage() {
  const toast = useToast();
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const bookingsState = useFetch(() => api.myBookings(), []);
  const bookings = bookingsState.data ?? [];

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const upcomingList = bookings.filter((b) => b.status !== 'cancelled' && !isPast(b, now));
    const pastList = bookings.filter((b) => b.status === 'cancelled' || isPast(b, now));
    return { upcoming: upcomingList, past: pastList };
  }, [bookings]);

  async function handleCancel(id: string) {
    setCancellingId(id);
    try {
      await api.cancelBooking(id);
      toast.showToast('Booking cancelled');
      bookingsState.reload();
    } catch (err) {
      toast.showToast(err instanceof Error ? err.message : 'Could not cancel booking', 'error');
      bookingsState.reload();
    } finally {
      setCancellingId(null);
    }
  }

  function renderList(items: typeof bookings) {
    return (
      <ul className="booking-list">
        {items.map((booking) => {
          const cancellable = canCancel(booking);
          const reason = cancelDisabledReason(booking);
          return (
            <li className="booking-card" key={booking.id}>
              <div className="booking-card__info">
                <span className="booking-card__title">{booking.title}</span>
                <span className="booking-card__meta">
                  {booking.roomName} · {booking.attendees} attendees
                </span>
                <span className="booking-card__meta">
                  {formatOccurrence(booking.occurrences[0])}
                  {booking.recurrence.kind === 'weekly' && ` · repeats weekly × ${booking.recurrence.count}`}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
                <StatusBadge status={booking.status} />
                <Button
                  variant="danger"
                  disabled={!cancellable}
                  loading={cancellingId === booking.id}
                  title={reason ?? 'Cancel this booking'}
                  aria-label={`Cancel ${booking.title}${reason ? ` (unavailable: ${reason})` : ''}`}
                  onClick={() => handleCancel(booking.id)}
                >
                  Cancel
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <section aria-label="My bookings">
      {bookingsState.loading && <SkeletonRows rows={3} />}

      {!bookingsState.loading && bookingsState.error && (
        <div className="state-panel state-panel--error" role="alert">
          <p>Could not load your bookings: {bookingsState.error}</p>
          <div className="state-panel__actions">
            <Button variant="secondary" onClick={bookingsState.reload}>
              Retry
            </Button>
          </div>
        </div>
      )}

      {!bookingsState.loading && !bookingsState.error && (
        <>
          <h2 className="section-title">Upcoming</h2>
          {upcoming.length === 0 ? (
            <div className="state-panel">
              <p>No upcoming bookings — pick a room in the grid to create one.</p>
            </div>
          ) : (
            renderList(upcoming)
          )}

          <h2 className="section-title">Past & cancelled</h2>
          {past.length === 0 ? (
            <div className="state-panel">
              <p>Nothing here yet.</p>
            </div>
          ) : (
            renderList(past)
          )}
        </>
      )}
    </section>
  );
}

function isPast(booking: { occurrences: Array<{ end: string }> }, now: Date): boolean {
  const first = booking.occurrences[0];
  return Boolean(first) && new Date(first.end).getTime() <= now.getTime();
}
