/** MyBookings — own upcoming/past bookings with window-aware cancel buttons. */
import type { BookingDto } from 'deskboard-shared';
import { api, ApiError } from '../api/client.js';
import { useAuth } from '../hooks/useAuth.js';
import { useResource } from '../hooks/useResource.js';
import { canCancelBooking, cancellationTooltip, splitUpcomingPast } from '../logic/slots.js';
import { Badge } from '../components/ui/Badge.js';
import { Button } from '../components/ui/Button.js';
import { Table, type TableColumn } from '../components/ui/Table.js';
import { useToast } from '../components/ui/Toast.jsx';
import { EmptyState, ErrorState, LoadingState } from '../components/States.js';

const STATUS_VARIANT: Record<BookingDto['status'], 'success' | 'warning' | 'neutral'> = {
  confirmed: 'success',
  completed: 'neutral',
  cancelled: 'warning'
};

export function MyBookingsPage({ reloadKey }: { reloadKey: number }) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const resource = useResource(() => api.myBookings(), [reloadKey]);

  if (resource.loading) return <LoadingState label="Loading your bookings…" />;
  if (resource.error) return <ErrorState message={resource.error} onRetry={resource.retry} />;

  const bookings = resource.data ?? [];
  const { upcoming, past } = splitUpcomingPast(bookings);

  if (!user) return null;
  const viewer = { id: user.id, role: user.role };

  const cancel = async (booking: BookingDto) => {
    try {
      await api.cancelBooking(booking.id);
      showToast('success', 'Booking cancelled');
      resource.retry();
    } catch (err) {
      showToast('error', err instanceof ApiError ? err.message : 'Could not cancel the booking');
    }
  };

  const columns: TableColumn<BookingDto>[] = [
    { key: 'title', header: 'Title', render: (b) => b.title },
    { key: 'start', header: 'When', render: (b) => `${b.start.replace('T', ' ')} – ${b.end.slice(11)}` },
    { key: 'attendees', header: 'Attendees', render: (b) => String(b.attendees) },
    {
      key: 'status',
      header: 'Status',
      render: (b) => <Badge variant={STATUS_VARIANT[b.status]}>{b.status}</Badge>
    },
    {
      key: 'actions',
      header: 'Actions',
      render: (b) => (
        <span title={cancellationTooltip(b, viewer)}>
          <Button
            variant="danger"
            disabled={!canCancelBooking(b, viewer)}
            aria-label={`Cancel ${b.title}`}
            onClick={() => cancel(b)}
          >
            Cancel
          </Button>
        </span>
      )
    }
  ];

  return (
    <div className="stack">
      <div className="page-section">
        <h1>My bookings</h1>
        <h2>Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState title="No upcoming bookings — pick a room in the grid" />
        ) : (
          <Table columns={columns} rows={upcoming} rowKey={(b) => b.id} />
        )}
      </div>
      <div className="page-section">
        <h2>Past &amp; cancelled</h2>
        {past.length === 0 ? (
          <EmptyState title="Nothing here yet" />
        ) : (
          <Table columns={columns.slice(0, 4)} rows={past} rowKey={(b) => b.id} />
        )}
      </div>
    </div>
  );
}
