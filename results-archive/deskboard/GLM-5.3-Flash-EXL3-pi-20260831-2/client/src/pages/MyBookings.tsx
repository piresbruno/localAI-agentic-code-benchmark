import { Booking } from '@deskboard/shared';
import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { useToast } from '../components/ui/Toast';
import { useAuth } from '../hooks/useAuth';
import { useAsync } from '../hooks/useAsync';
import { cancellationBlocker, formatBookingRange } from '../lib/slots';
import { DataView } from './DataView';

const STATUS_META: Record<Booking['status'], { icon: string; label: string }> = {
  confirmed: { icon: '●', label: 'Confirmed' },
  cancelled: { icon: '⊘', label: 'Cancelled' },
  completed: { icon: '✓', label: 'Completed' },
};

/** The organizer's own bookings, split upcoming/past, with window-aware cancel. */
export function MyBookings({ onBrowse }: { onBrowse: () => void }) {
  const { user } = useAuth();
  const showToast = useToast();
  const { data, loading, error, retry } = useAsync(() => api.myBookings(), []);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isAdmin = user?.role === 'admin';
  const bookings = data ?? [];
  const now = new Date();
  const upcoming = bookings.filter((b) => new Date(b.end).getTime() > now.getTime());
  const past = bookings.filter((b) => new Date(b.end).getTime() <= now.getTime());

  async function cancel(booking: Booking) {
    if (busyId) return;
    setBusyId(booking.id);
    try {
      await api.cancelBooking(booking.id);
      showToast('Booking cancelled');
      retry();
    } catch (err) {
      showToast(err instanceof ApiError ? err.message : 'Could not cancel the booking', 'error');
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section aria-labelledby="bookings-heading">
      <h1 id="bookings-heading">My bookings</h1>
      <DataView
        loading={loading}
        error={error}
        retry={retry}
        isEmpty={bookings.length === 0}
        empty={
          <div className="data-empty">
            <p>No bookings yet — pick a room from the grid to get started.</p>
            <Button onClick={onBrowse}>Browse rooms</Button>
          </div>
        }
      >
        <BookingTable
          heading="Upcoming"
          bookings={upcoming}
          now={now}
          isAdmin={isAdmin}
          busyId={busyId}
          onCancel={cancel}
        />
        <BookingTable
          heading="Past"
          bookings={past}
          now={now}
          isAdmin={isAdmin}
          busyId={busyId}
          onCancel={cancel}
        />
      </DataView>
    </section>
  );
}

function BookingTable({
  heading,
  bookings,
  now,
  isAdmin,
  busyId,
  onCancel,
}: {
  heading: string;
  bookings: Booking[];
  now: Date;
  isAdmin: boolean;
  busyId: string | null;
  onCancel: (booking: Booking) => void;
}) {
  return (
    <div className="table-block">
      <h2 className="table-heading">{heading}</h2>
      <Table
        headers={['Room', 'Title', 'When', 'Status', 'Attendees', 'Actions']}
        count={bookings.length}
        emptyMessage={`No ${heading.toLowerCase()} bookings.`}
      >
        {bookings.map((booking) => {
          const blocker = cancellationBlocker(booking, now, isAdmin);
          const meta = STATUS_META[booking.status];
          return (
            <tr key={booking.id}>
              <td>{booking.roomName}</td>
              <td>{booking.title}</td>
              <td>{formatBookingRange(booking.start, booking.end)}</td>
              <td>
                <span className={`badge badge-${booking.status}`}>
                  <span aria-hidden="true">{meta.icon}</span> {meta.label}
                </span>
              </td>
              <td>{booking.attendees}</td>
              <td>
                <Button
                  variant="danger"
                  onClick={() => onCancel(booking)}
                  disabled={blocker !== null || busyId === booking.id}
                  loading={busyId === booking.id}
                  aria-label={`Cancel ${booking.title}`}
                  title={blocker ?? `Cancel ${booking.title}`}
                >
                  Cancel
                </Button>
              </td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
