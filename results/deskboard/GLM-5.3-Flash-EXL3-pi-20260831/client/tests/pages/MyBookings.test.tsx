import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../src/api/client';
import { AuthProvider } from '../../src/hooks/useAuth';
import { ToastProvider } from '../../src/components/ui/Toast';
import { MyBookings } from '../../src/pages/MyBookings';
import type { BookingDto } from '@deskboard/shared';

vi.mock('../../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/client')>();
  return {
    ...actual,
    api: { ...actual.api, myBookings: vi.fn(), cancelBooking: vi.fn() },
  };
});

/** Local ISO `YYYY-MM-DDTHH:mm` relative to now (canCancel parses local time). */
function localIn(hoursAhead: number): string {
  const d = new Date(Date.now() + hoursAhead * 3600_000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function booking(overrides: Partial<BookingDto> = {}): BookingDto {
  return {
    id: 'b1',
    roomId: 'r1',
    roomName: 'Fjord',
    title: 'Sprint sync',
    organizerId: 'u1',
    organizerName: 'Emma',
    start: localIn(3),
    end: localIn(4),
    status: 'confirmed',
    attendees: 2,
    createdAt: localIn(-24),
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <MyBookings />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('MyBookings', () => {
  it('enables cancel outside the window and calls the API', async () => {
    vi.mocked(api.myBookings).mockResolvedValue([booking()]);
    vi.mocked(api.cancelBooking).mockResolvedValue(booking({ status: 'cancelled' }));
    renderPage();
    const btn = await screen.findByRole('button', { name: 'Cancel Sprint sync' });
    expect(btn).toBeEnabled();
    await userEvent.click(btn);
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledWith('b1'));
  });

  it('disables cancel inside the 1h window with an explanatory tooltip', async () => {
    vi.mocked(api.myBookings).mockResolvedValue([booking({ start: localIn(0.5), end: localIn(1.5) })]);
    renderPage();
    const wrapper = await screen.findByTitle('Cancellations close 1 hour before the start time.');
    expect(wrapper.querySelector('button')).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel Sprint sync' })).toBeDisabled();
  });

  it('shows the empty state with a call to action', async () => {
    vi.mocked(api.myBookings).mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText('No bookings yet — pick a room')).toBeInTheDocument();
  });

  it('shows a friendly error state with retry when the API fails', async () => {
    vi.mocked(api.myBookings).mockRejectedValue(new Error('boom'));
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
