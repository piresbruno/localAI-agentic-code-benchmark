import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { BookingResponse } from 'shared';
import { bookingsApi } from '../api/endpoints';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/ui/Toast';
import { Badge, bookingStatusLabel, bookingStatusTone } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { EmptyState, ErrorState, LoadingState } from '../components/States';
import { canCancelBooking, cancelWindowHint, formatDateTime } from '../logic/booking';

export function MyBookingsPage() {
  const toast = useToast();
  const { data, loading, error, reload } = useAsync(bookingsApi.mine, []);
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  async function onCancel(booking: BookingResponse) {
    setCancellingId(booking.id);
    try {
      await bookingsApi.cancel(booking.id);
      toast.push('success', 'Booking cancelled');
      reload();
    } catch (err) {
      toast.push('error', err instanceof Error ? err.message : 'Could not cancel booking');
      reload();
    } finally {
      setCancellingId(null);
    }
  }

  const now = new Date();
  const upcoming = (data ?? []).filter((b) => b.status === 'confirmed' || b.status === 'completed');
  const past = (data ?? []).filter((b) => b.status === 'cancelled');

  return (
    <section>
      <h1 className="page-title">My bookings</h1>

      {loading ? <LoadingState label="Loading bookings…" /> : null}
      {error ? <ErrorState message={error} onRetry={reload} /> : null}

      {data && !error ? (
        <>
          <h2 className="section-title">Upcoming & past</h2>
          {upcoming.length === 0 ? (
            <EmptyState
              title="No bookings yet — pick a room"
              action={
                <Link className="btn btn-primary" to="/">
                  Book a room
                </Link>
              }
            />
          ) : (
            <Table
              caption="Your bookings"
              headers={['Room', 'Title', 'Start', 'End', 'Attendees', 'Status', '']}
              emptyMessage="No bookings"
            >
              {upcoming.map((booking) => {
                const cancellable =
                  booking.status === 'confirmed' && canCancelBooking(booking, now);
                return (
                  <tr key={booking.id}>
                    <td>{booking.roomName}</td>
                    <td>{booking.title}</td>
                    <td>{formatDateTime(booking.start)}</td>
                    <td>{formatDateTime(booking.end)}</td>
                    <td>{booking.attendees}</td>
                    <td>
                      <Badge tone={bookingStatusTone(booking.status)}>
                        {bookingStatusLabel(booking.status)}
                      </Badge>
                    </td>
                    <td>
                      <Button
                        variant="danger"
                        size="sm"
                        disabled={!cancellable}
                        title={cancellable ? undefined : cancelWindowHint(booking)}
                        loading={cancellingId === booking.id}
                        onClick={() => onCancel(booking)}
                      >
                        Cancel
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </Table>
          )}

          {past.length > 0 ? (
            <>
              <h2 className="section-title">Cancelled</h2>
              <Table
                caption="Cancelled bookings"
                headers={['Room', 'Title', 'Start', 'Status']}
                emptyMessage="—"
              >
                {past.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.roomName}</td>
                    <td>{booking.title}</td>
                    <td>{formatDateTime(booking.start)}</td>
                    <td>
                      <Badge tone={bookingStatusTone(booking.status)}>
                        {bookingStatusLabel(booking.status)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </Table>
            </>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
