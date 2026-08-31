import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BookingDto } from '@deskboard/shared';

vi.mock('../src/api/client.js', () => ({
  ApiError: class ApiError extends Error {},
  setAuthToken: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

import { api } from '../src/api/client.js';
import { MyBookingsPage } from '../src/pages/MyBookingsPage.js';
import { ToastProvider } from '../src/components/ui/Toast.js';

const mockApi = vi.mocked(api, true);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** "Now" is fixed so the cancellation window is deterministic. */
const NOW = new Date(2026, 8, 1, 12, 0);

const booking = (over: Partial<BookingDto> = {}): BookingDto => ({
  id: 'b1',
  roomId: 'r1',
  roomName: 'Board Room',
  title: 'Sprint planning',
  organizerId: 'u1',
  start: '2026-09-01T14:00',
  end: '2026-09-01T15:00',
  status: 'confirmed',
  attendees: 4,
  createdAt: '2026-08-31T10:00',
  ...over,
});

function renderPage() {
  return render(
    <ToastProvider>
      <MyBookingsPage onChanged={() => {}} now={NOW} />
    </ToastProvider>,
  );
}

describe('MyBookingsPage', () => {
  it('shows the empty state with a call to action', async () => {
    mockApi.get.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No bookings yet — pick a room/i)).toBeInTheDocument();
  });

  it('lists upcoming and past bookings with status chips', async () => {
    mockApi.get.mockResolvedValue([
      booking(),
      booking({
        id: 'b2',
        title: 'Retro',
        start: '2026-09-01T09:00',
        end: '2026-09-01T10:00',
        status: 'completed',
      }),
      booking({ id: 'b3', title: '1:1', status: 'cancelled' }),
    ]);
    renderPage();

    expect(await screen.findByText('Sprint planning')).toBeInTheDocument();
    expect(screen.getByText('confirmed')).toBeInTheDocument();
    expect(screen.getByText('completed')).toBeInTheDocument();
    expect(screen.getByText('cancelled')).toBeInTheDocument();
  });

  it('enables cancel inside the window and calls DELETE', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([booking()]);
    mockApi.del.mockResolvedValue(booking({ status: 'cancelled' }));
    renderPage();

    const button = await screen.findByRole('button', { name: 'Cancel Sprint planning' });
    expect(button).toBeEnabled();

    await user.click(button);
    await vi.waitFor(() => expect(mockApi.del).toHaveBeenCalledWith('/bookings/b1'));
  });

  it('disables cancel with an explanatory tooltip inside the 1h window', async () => {
    mockApi.get.mockResolvedValue([
      // NOW is 12:00 — start 12:30 leaves 30 minutes: window closed.
      booking({ id: 'b4', start: '2026-09-01T12:30', end: '2026-09-01T13:30' }),
    ]);
    renderPage();

    const button = await screen.findByRole('button', { name: 'Cancel Sprint planning' });
    expect(button).toBeDisabled();
    const wrapper = button.closest('span');
    expect(wrapper).toHaveAttribute('title', expect.stringMatching(/up to 60 minutes before/i));
  });
});
