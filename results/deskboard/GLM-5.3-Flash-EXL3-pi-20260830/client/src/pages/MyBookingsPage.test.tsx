// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client.js';

vi.mock('../hooks/useAuth.js', () => ({
  useAuth: () => ({
    user: { id: 'u-1', name: 'Nina', email: 'nina@example.com', role: 'employee' },
    ready: true,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn()
  })
}));

vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      myBookings: vi.fn(),
      cancelBooking: vi.fn()
    }
  };
});

import { api } from '../api/client.js';
import { MyBookingsPage } from './MyBookingsPage.js';
import { ToastProvider } from '../components/ui/Toast.jsx';

// NOW within tests: real clock. Use offsets relative to actual time so the
// cancellation window behaves deterministically.
const inTwoHours = (): string => {
  const d = new Date(Date.now() + 2 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const inThirtyMinutes = (): string => {
  const d = new Date(Date.now() + 30 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

import type { BookingDto } from 'deskboard-shared';

const booking = (over: Partial<BookingDto>): BookingDto => ({
  id: 'b-1',
  groupId: 'g-1',
  roomId: 'r-1',
  title: 'Kickoff',
  organizer: { id: 'u-1', name: 'Nina', email: 'nina@example.com', role: 'employee' },
  start: inTwoHours(),
  end: inTwoHours(),
  recurrence: { kind: 'none' },
  status: 'confirmed',
  attendees: 2,
  createdAt: '2026-09-07T08:00',
  ...over
});

describe('MyBookingsPage', () => {
  beforeEach(() => {
    vi.mocked(api.myBookings).mockReset();
    vi.mocked(api.cancelBooking).mockReset();
    vi.mocked(api.cancelBooking).mockResolvedValue(booking({}));
  });

  it('renders upcoming bookings with an enabled cancel button', async () => {
    vi.mocked(api.myBookings).mockResolvedValue([
      booking({ id: 'b-1', start: inTwoHours(), end: inTwoHours() })
    ]);
    render(
      <ToastProvider>
        <MyBookingsPage reloadKey={0} />
      </ToastProvider>
    );

    expect(await screen.findByText('Kickoff')).toBeInTheDocument();
    const cancel = screen.getByRole('button', { name: 'Cancel Kickoff' });
    expect(cancel).toBeEnabled();
    expect(cancel.closest('span')).toHaveAttribute('title', 'Cancel this booking');
  });

  it('disables cancel inside the 1h window with an explanatory tooltip', async () => {
    vi.mocked(api.myBookings).mockResolvedValue([
      booking({ id: 'b-2', title: 'Soon', start: inThirtyMinutes(), end: inTwoHours() })
    ]);
    render(
      <ToastProvider>
        <MyBookingsPage reloadKey={0} />
      </ToastProvider>
    );

    const cancel = await screen.findByRole('button', { name: 'Cancel Soon' });
    expect(cancel).toBeDisabled();
    expect(cancel.closest('span')?.getAttribute('title')).toMatch(/1 hour/);
  });

  it('calls the API on cancel and refreshes the list', async () => {
    vi.mocked(api.myBookings)
      .mockResolvedValueOnce([booking({ id: 'b-1', start: inTwoHours(), end: inTwoHours() })])
      .mockResolvedValueOnce([
        booking({ id: 'b-1', start: inTwoHours(), end: inTwoHours(), status: 'cancelled' })
      ]);
    render(
      <ToastProvider>
        <MyBookingsPage reloadKey={0} />
      </ToastProvider>
    );

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Kickoff' }));
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledWith('b-1'));
    await waitFor(() => expect(api.myBookings).toHaveBeenCalledTimes(2));
    expect(await screen.findByText('Booking cancelled')).toBeInTheDocument();
  });

  it('shows the empty state with a call to action', async () => {
    vi.mocked(api.myBookings).mockResolvedValue([]);
    render(
      <ToastProvider>
        <MyBookingsPage reloadKey={0} />
      </ToastProvider>
    );
    expect(
      await screen.findByText('No upcoming bookings — pick a room in the grid')
    ).toBeInTheDocument();
  });

  it('shows the error state with retry when the API fails', async () => {
    vi.mocked(api.myBookings).mockRejectedValue(
      new ApiError('UNAUTHENTICATED', 'Invalid or expired token', 401)
    );
    render(
      <ToastProvider>
        <MyBookingsPage reloadKey={0} />
      </ToastProvider>
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });
});
