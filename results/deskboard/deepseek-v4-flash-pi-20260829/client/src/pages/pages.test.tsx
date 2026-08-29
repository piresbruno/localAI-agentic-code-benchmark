import { screen, waitFor } from '@testing-library/react';
import { toLocalDateString } from '../logic/booking';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginPage } from './LoginPage';
import { BookingFormPage } from './BookingFormPage';
import { MyBookingsPage } from './MyBookingsPage';
import { RoomGridPage } from './RoomGridPage';
import { jsonResponse, renderWithProviders, stubFetch, USER } from '../test/utils';
import type { AvailabilityResponse, BookingResponse, Room } from 'shared';

const FIXED_DATE = '2026-08-27';

afterEach(() => {
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

const room: Room = {
  id: 'r1',
  name: 'Atlas',
  capacity: 8,
  floor: 3,
  features: ['screen'],
  active: true,
};
const inactiveRoom: Room = { ...room, id: 'r2', name: 'Orion', active: false };

function availability(occupied: number[] = []): AvailabilityResponse {
  return {
    date: FIXED_DATE,
    roomId: room.id,
    roomName: room.name,
    slots: Array.from({ length: 11 }, (_, i) => {
      const hour = 8 + i;
      const busy = occupied.includes(hour);
      return {
        start: new Date(2026, 7, 27, hour, 0, 0, 0).toISOString(),
        end: new Date(2026, 7, 27, hour + 1, 0, 0, 0).toISOString(),
        status: busy ? 'busy' : 'free',
        bookings: busy
          ? [
              {
                id: 'b1',
                title: 'Sprint planning',
                status: 'confirmed' as const,
                organizerId: 'u1',
              },
            ]
          : [],
      };
    }),
  };
}

// ---------------------------------------------------------------------------
describe('LoginPage', () => {
  it('validates fields inline before hitting the API', async () => {
    const user = userEvent.setup();
    stubFetch({});
    renderWithProviders(<LoginPage />, { token: false });
    await user.click(screen.getByRole('button', { name: 'Log in' }));
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.length).toBeGreaterThanOrEqual(2); // email + password
    expect(alerts[0]).toHaveTextContent('required');
  });

  it('submits credentials and shows the API error message on failure', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch({
      '/api/auth/login': () =>
        jsonResponse(
          { error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' } },
          401,
        ),
    });
    renderWithProviders(<LoginPage />, { token: false });
    await user.type(screen.getByLabelText('Email'), 'grace@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Log in' }));

    expect((await screen.findAllByText('Invalid email or password')).length).toBeGreaterThan(0);
    expect(calls[0]).toMatchObject({ url: '/api/auth/login', method: 'POST' });
    expect(calls[0]?.body).toMatchObject({ email: 'grace@example.com' });
  });

  it('registers and stores the token on success', async () => {
    const user = userEvent.setup();
    stubFetch({
      '/api/auth/register': () => ({ token: 'jwt-1', user: USER }),
    });
    renderWithProviders(<LoginPage />, { token: false });
    await user.click(screen.getByRole('tab', { name: 'Register' }));
    await user.type(screen.getByLabelText('Name'), 'Grace Hopper');
    await user.type(screen.getByLabelText('Email'), 'grace@example.com');
    await user.type(screen.getByLabelText('Password'), 'supersecret');
    await user.click(screen.getByRole('button', { name: 'Create account' }));
    await waitFor(() => expect(window.localStorage.getItem('deskboard.token')).toBe('jwt-1'));
  });
});

// ---------------------------------------------------------------------------
describe('BookingFormPage', () => {
  it('locks the prefilled room, validates against the shared schema and creates a booking', async () => {
    const user = userEvent.setup();
    stubFetch({
      '/api/rooms': () => [room, inactiveRoom],
      '/api/bookings': () => [{ ...bookingResponse(), roomName: room.name }],
    });
    renderWithProviders(<BookingFormPage />, {
      route: `/bookings/new?room=${room.id}&date=${FIXED_DATE}&start=14:00`,
    });
    expect(await screen.findByText('Atlas (fixed)')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Room' })).not.toBeInTheDocument();

    await user.type(screen.getByLabelText('Title'), 'Sprint planning');
    await user.click(screen.getByRole('button', { name: 'Book room' }));

    await waitFor(() => {
      expect(screen.getByText(/Booking created/)).toBeInTheDocument();
    });
  });

  it('surfaces a ROOM_CONFLICT error from the API contract inline', async () => {
    const user = userEvent.setup();
    stubFetch({
      '/api/rooms': () => [room],
      '/api/bookings': () =>
        jsonResponse(
          {
            error: {
              code: 'ROOM_CONFLICT',
              message: 'The room is already booked during this time',
            },
          },
          409,
        ),
    });
    renderWithProviders(<BookingFormPage />, {
      route: `/bookings/new?room=${room.id}&date=${FIXED_DATE}&start=14:00`,
    });
    await screen.findByText('Atlas (fixed)');
    await user.type(screen.getByLabelText('Title'), 'Sprint planning');
    await user.click(screen.getByRole('button', { name: 'Book room' }));
    expect(
      (await screen.findAllByText('The room is already booked during this time')).length,
    ).toBeGreaterThan(0);
  });

  it('is double-submit safe while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveBooking: (value: unknown) => void = () => undefined;
    const pending = new Promise((resolve) => {
      resolveBooking = resolve;
    });
    const { calls } = stubFetch({
      '/api/rooms': () => [room],
      '/api/bookings': () => pending,
    });
    renderWithProviders(<BookingFormPage />, { route: `/bookings/new?room=${room.id}` });
    await screen.findByText('Atlas (fixed)');
    await user.type(screen.getByLabelText('Title'), 'Sprint planning');
    const submit = screen.getByRole('button', { name: /Book room/ });
    await user.click(submit);
    expect(submit).toBeDisabled();
    await user.click(submit);
    resolveBooking([bookingResponse()]);
    await waitFor(() => expect(calls.filter((c) => c.url === '/api/bookings')).toHaveLength(1));
  });
});

// ---------------------------------------------------------------------------
describe('MyBookingsPage', () => {
  const futureBooking: BookingResponse = {
    ...bookingResponse(),
    start: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
    end: new Date(Date.now() + 3 * 60 * 60_000).toISOString(),
  };
  const imminentBooking: BookingResponse = {
    ...bookingResponse(),
    id: 'b2',
    title: 'Quick sync',
    start: new Date(Date.now() + 10 * 60_000).toISOString(),
    end: new Date(Date.now() + 70 * 60_000).toISOString(),
  };
  const cancelledBooking: BookingResponse = {
    ...bookingResponse(),
    id: 'b3',
    title: 'Design review',
    status: 'cancelled',
  };

  it('renders bookings, disables cancel inside the window and cancels otherwise', async () => {
    const user = userEvent.setup();
    const { calls } = stubFetch({
      '/api/bookings/mine': () => [futureBooking, imminentBooking, cancelledBooking],
      '/api/bookings/b1': () => ({ ...futureBooking, status: 'cancelled' }),
      '/api/bookings/mine?reload': () => [futureBooking, imminentBooking, cancelledBooking],
    });
    renderWithProviders(<MyBookingsPage />);

    expect(await screen.findByText('Sprint planning')).toBeInTheDocument();
    const cancelButtons = screen.getAllByRole('button', { name: 'Cancel' });
    // Two cancellable rows (confirmed); the imminent one must be disabled.
    expect(cancelButtons).toHaveLength(2);
    expect(cancelButtons[0]).not.toBeDisabled();

    await user.click(cancelButtons[0]!);
    await waitFor(() =>
      expect(calls.some((c) => c.url === '/api/bookings/b1' && c.method === 'DELETE')).toBe(true),
    );
  });

  it('shows the empty state with a call to action when there are no bookings', async () => {
    stubFetch({ '/api/bookings/mine': () => [] });
    renderWithProviders(<MyBookingsPage />);
    expect(await screen.findByText('No bookings yet — pick a room')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Book a room' })).toHaveAttribute('href', '/');
  });

  it('shows a friendly error with retry when the API fails', async () => {
    const user = userEvent.setup();
    stubFetch({
      '/api/bookings/mine': () =>
        jsonResponse({ error: { code: 'INTERNAL', message: 'Internal server error' } }, 500),
    });
    renderWithProviders(<MyBookingsPage />);
    expect(await screen.findByText('Internal server error')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(screen.getByText('Internal server error')).toBeInTheDocument();
  });
});

// ---------------------------------------------------------------------------
describe('RoomGridPage', () => {
  it('renders the room × hour grid with free slots and busy bookings', async () => {
    const today = toLocalDateString(new Date());
    stubFetch({
      '/api/rooms': () => [room, inactiveRoom],
      [`/api/rooms/r1/availability?date=${today}`]: () => availability([14]),
    });
    renderWithProviders(<RoomGridPage />, { route: '/' });
    expect(await screen.findByText('Atlas')).toBeInTheDocument();
    // 12 free + 1 busy as a button-free cell; free slot 08:00 has a book button.
    const bookButton = await screen.findByRole('button', { name: 'Book Atlas at 08:00' });
    expect(bookButton).toBeInTheDocument();
    expect(screen.getByText('Sprint planning')).toBeInTheDocument();
    expect(screen.queryByText('Orion')).not.toBeInTheDocument(); // inactive rooms hidden
  });

  it('shows an empty state and recovers via retry after an error', async () => {
    stubFetch({
      '/api/rooms': () => [],
    });
    const first = renderWithProviders(<RoomGridPage />, { route: '/' });
    expect(await first.findByText('No active rooms yet')).toBeInTheDocument();
    first.unmount();

    const user = userEvent.setup();
    stubFetch({
      '/api/rooms': () =>
        jsonResponse({ error: { code: 'INTERNAL', message: 'Internal server error' } }, 500),
    });
    const second = renderWithProviders(<RoomGridPage />, { route: '/' });
    expect(await second.findByText('Internal server error')).toBeInTheDocument();

    // Retry after the API recovers clears the error and renders the grid.
    const today = toLocalDateString(new Date());
    stubFetch({
      '/api/rooms': () => [room],
      [`/api/rooms/r1/availability?date=${today}`]: () => availability(),
    });
    await user.click(second.getByRole('button', { name: 'Retry' }));
    expect(await second.findByText('Atlas')).toBeInTheDocument();
  });
});

function bookingResponse(): BookingResponse {
  return {
    id: 'b1',
    roomId: 'r1',
    roomName: 'Atlas',
    title: 'Sprint planning',
    organizerId: 'u1',
    start: '2026-08-27T14:00:00.000Z',
    end: '2026-08-27T15:00:00.000Z',
    recurrence: { kind: 'none' },
    status: 'confirmed',
    attendees: 4,
    createdAt: '2026-08-26T10:00:00.000Z',
  };
}
