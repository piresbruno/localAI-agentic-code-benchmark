import { Link } from 'react-router-dom';
import type { BookingDto } from '@deskboard/shared';
import { api } from '../api/client';
import { useAuth } from '../hooks/useAuth';
import { toMessage, useResource } from '../hooks/useResource';
import { canCancel, partitionBookings, timeRange } from '../lib/slots';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';
import { EmptyState, ErrorState, LoadingBlock } from '../components/States';

const CANCEL_TOOLTIP = 'Cancellations close 1 hour before the start time.';

/** MyBookings (spec §6): own upcoming/past bookings; cancel respects the 1h window. */
export function MyBookings() {
  const { user } = useAuth();
  const toast = useToast();
  const bookings = useResource(() => api.myBookings(), []);

  const cancel = async (booking: BookingDto) => {
    try {
      await api.cancelBooking(booking.id);
      toast.push('Booking cancelled.');
      bookings.retry();
    } catch (err) {
      toast.push(toMessage(err), 'error');
    }
  };

  if (bookings.loading) return <LoadingBlock label="Loading your bookings…" />;
  if (bookings.error) return <ErrorState message={bookings.error} onRetry={bookings.retry} />;

  const now = new Date();
  const { upcoming, past } = partitionBookings(bookings.data ?? [], now);
  const isAdmin = user?.role === 'admin';

  return (
    <>
      <h1 className="page-title">My bookings</h1>
      <p className="page-subtitle">Organizers can cancel up to 1 hour before the start; admins anytime.</p>
      <div className="bookings-columns">
        <section aria-labelledby="upcoming-heading">
          <h2 id="upcoming-heading" className="page-subtitle" style={{ fontWeight: 600 }}>
            Upcoming
          </h2>
          {upcoming.length === 0 ? (
            <EmptyState title="No bookings yet — pick a room">
              <Link to="/">
                <Button variant="secondary">Go to room grid</Button>
              </Link>
            </EmptyState>
          ) : (
            <ul className="list">
              {upcoming.map((b) => (
                <li key={b.id} className="list-item">
                  <div>
                    <strong>{b.title}</strong>
                    <div className="list-item__meta">
                      {b.roomName} · {b.start.slice(0, 10)} · {timeRange(b)} · {b.attendees} attendees ·{' '}
                      <Badge status={b.status} />
                    </div>
                  </div>
                  <CancelButton booking={b} isAdmin={isAdmin} onCancel={() => cancel(b)} />
                </li>
              ))}
            </ul>
          )}
        </section>
        <section aria-labelledby="past-heading">
          <h2 id="past-heading" className="page-subtitle" style={{ fontWeight: 600 }}>
            Past &amp; cancelled
          </h2>
          {past.length === 0 ? (
            <EmptyState title="Nothing here yet" />
          ) : (
            <ul className="list">
              {past.map((b) => (
                <li key={b.id} className="list-item">
                  <div>
                    <strong>{b.title}</strong>
                    <div className="list-item__meta">
                      {b.roomName} · {b.start.slice(0, 10)} · {timeRange(b)} · <Badge status={b.status} />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}

function Badge({ status }: { status: BookingDto['status'] }) {
  const icon = status === 'confirmed' ? '●' : status === 'completed' ? '✔' : '✖';
  return (
    <span className={`badge badge--${status}`}>
      <span aria-hidden="true">{icon}</span> {status}
    </span>
  );
}

function CancelButton({
  booking,
  isAdmin,
  onCancel,
}: {
  booking: BookingDto;
  isAdmin: boolean;
  onCancel: () => void;
}) {
  const allowed = isAdmin || canCancel(booking, new Date());
  return (
    <span title={allowed ? undefined : CANCEL_TOOLTIP}>
      <Button variant="danger" disabled={!allowed} onClick={onCancel} aria-label={`Cancel ${booking.title}`}>
        Cancel
      </Button>
    </span>
  );
}
