// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/api/client', () => {
  class ApiError extends Error {
    status: number;
    code: string;
    details?: Record<string, string[]>;
    constructor(
      status: number,
      body: { code: string; message: string; details?: Record<string, string[]> },
    ) {
      super(body.message);
      this.status = status;
      this.code = body.code;
      this.details = body.details;
    }
  }
  return {
    ApiError,
    getToken: vi.fn(() => 'test-token'),
    setToken: vi.fn(),
    api: {
      register: vi.fn(),
      login: vi.fn(),
      me: vi.fn(),
      listRooms: vi.fn(),
      createRoom: vi.fn(),
      updateRoom: vi.fn(),
      deactivateRoom: vi.fn(),
      availability: vi.fn(),
      createBooking: vi.fn(),
      myBookings: vi.fn(),
      cancelBooking: vi.fn(),
    },
  };
});

import { api, ApiError } from '../src/api/client';
import { ToastProvider } from '../src/components/ui/Toast';
import { AuthProvider } from '../src/hooks/useAuth';
import { AdminRooms } from '../src/pages/AdminRooms';
import { BookingForm } from '../src/pages/BookingForm';
import { Login } from '../src/pages/Login';
import { MyBookings } from '../src/pages/MyBookings';
import { RoomGrid } from '../src/pages/RoomGrid';
import { Booking, Room, User } from '@deskboard/shared';

const employee: User = { id: 'u1', name: 'Dana', email: 'dana@x.local', role: 'employee' };
const admin: User = { id: 'a1', name: 'Ada', email: 'admin@x.local', role: 'admin' };

const hudson: Room = {
  id: 'r1',
  name: 'Hudson',
  capacity: 8,
  floor: 3,
  features: ['screen'],
  active: true,
};
const inactive: Room = { ...hudson, id: 'r2', name: 'Old', capacity: 4, floor: 1, active: false };

const booking = (overrides: Partial<Booking> = {}): Booking => ({
  id: 'b1',
  roomId: 'r1',
  roomName: 'Hudson',
  title: 'Design review',
  organizerId: 'u1',
  start: new Date(Date.now() + 24 * 3600_000).toISOString(),
  end: new Date(Date.now() + 25 * 3600_000).toISOString(),
  status: 'confirmed',
  attendees: 3,
  createdAt: new Date().toISOString(),
  ...overrides,
});

beforeEach(() => {
  vi.mocked(api.me).mockResolvedValue(employee);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderInProviders = (ui: React.ReactElement) =>
  render(
    <ToastProvider>
      <AuthProvider>{ui}</AuthProvider>
    </ToastProvider>,
  );

describe('Login', () => {
  it('submits credentials through the auth hook', async () => {
    vi.mocked(api.login).mockResolvedValue({ token: 't', user: employee });
    renderInProviders(<Login />);
    await userEvent.type(screen.getByLabelText('Email'), 'dana@x.local');
    await userEvent.type(screen.getByLabelText('Password'), 'long-enough-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    await waitFor(() =>
      expect(api.login).toHaveBeenCalledWith({
        email: 'dana@x.local',
        password: 'long-enough-password',
      }),
    );
    expect(await screen.findByText('Welcome back!')).toBeInTheDocument();
  });

  it('shows the API error message inline on failure', async () => {
    vi.mocked(api.login).mockRejectedValue(
      new ApiError(401, { code: 'UNAUTHENTICATED', message: 'Invalid email or password' }),
    );
    renderInProviders(<Login />);
    await userEvent.type(screen.getByLabelText('Email'), 'dana@x.local');
    await userEvent.type(screen.getByLabelText('Password'), 'nope-nope-nope');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});

describe('RoomGrid', () => {
  const grid = {
    roomId: 'r1',
    date: '2026-09-01',
    slots: [
      { start: '09:00', end: '10:00', available: false, bookingId: 'b9', title: 'Standup' },
      { start: '10:00', end: '11:00', available: true },
    ],
  };

  it('renders active rooms with busy and free slots; clicking a free slot books it', async () => {
    vi.mocked(api.listRooms).mockResolvedValue([hudson, inactive]);
    vi.mocked(api.availability).mockResolvedValue(grid);
    const onBook = vi.fn();
    renderInProviders(<RoomGrid onBook={onBook} />);

    expect(await screen.findByText('Hudson')).toBeInTheDocument();
    expect(screen.queryByText('Old')).not.toBeInTheDocument(); // inactive rooms hidden
    expect(api.availability).toHaveBeenCalledWith('r1', expect.any(String));
    expect(screen.getByText('Standup')).toBeInTheDocument(); // busy slot shows booking title

    await userEvent.click(screen.getByRole('button', { name: 'Book Hudson at 10:00' }));
    expect(onBook).toHaveBeenCalledWith(
      expect.objectContaining({ roomId: 'r1', start: '10:00' }),
    );
  });

  it('shows a friendly error with retry when the API fails', async () => {
    vi.mocked(api.listRooms).mockRejectedValue(
      new ApiError(0, { code: 'NETWORK_ERROR', message: 'Cannot reach the server.' }),
    );
    renderInProviders(<RoomGrid onBook={vi.fn()} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Cannot reach the server.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('BookingForm', () => {
  it('submits with the computed end time and locked room from the prefill', async () => {
    vi.mocked(api.listRooms).mockResolvedValue([hudson]);
    vi.mocked(api.createBooking).mockResolvedValue(booking());
    const onBooked = vi.fn();
    renderInProviders(
      <BookingForm prefill={{ roomId: 'r1', date: '2026-09-01', start: '10:00' }} onBooked={onBooked} />,
    );

    const roomSelect = await screen.findByLabelText('Room');
    expect(roomSelect).toBeDisabled(); // locked to the grid selection

    await userEvent.type(screen.getByLabelText('Title'), 'Design review');
    await userEvent.click(screen.getByRole('button', { name: 'Book room' }));

    await waitFor(() =>
      expect(api.createBooking).toHaveBeenCalledWith({
        roomId: 'r1',
        title: 'Design review',
        start: '2026-09-01T10:00',
        end: '2026-09-01T11:00', // default 60-minute duration
        attendees: 2,
      }),
    );
    await waitFor(() => expect(onBooked).toHaveBeenCalled());
  });

  it('surfaces rule violations (422) from the API error contract', async () => {
    vi.mocked(api.listRooms).mockResolvedValue([hudson]);
    vi.mocked(api.createBooking).mockRejectedValue(
      new ApiError(422, { code: 'RULE_VIOLATION', message: 'Bookings may last at most 4 hours' }),
    );
    renderInProviders(
      <BookingForm prefill={{ roomId: 'r1', date: '2026-09-01', start: '09:00' }} onBooked={vi.fn()} />,
    );
    await userEvent.type(await screen.findByLabelText('Title'), 'Too long');
    await userEvent.click(screen.getByRole('button', { name: 'Book room' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Bookings may last at most 4 hours',
    );
  });
});

describe('MyBookings', () => {
  it('lists bookings and disables cancel inside the window with a tooltip reason', async () => {
    vi.mocked(api.myBookings).mockResolvedValue([
      booking(), // starts tomorrow → cancellable
      booking({
        id: 'b2',
        title: 'Starting soon',
        start: new Date(Date.now() + 30 * 60_000).toISOString(), // inside the 1h window
        end: new Date(Date.now() + 90 * 60_000).toISOString(),
      }),
    ]);
    renderInProviders(<MyBookings onBrowse={vi.fn()} />);

    expect(await screen.findByText('Design review')).toBeInTheDocument();
    expect(screen.getByText('Starting soon')).toBeInTheDocument();

    const ok = screen.getByRole('button', { name: 'Cancel Design review' });
    expect(ok).toBeEnabled();
    const blocked = screen.getByRole('button', { name: 'Cancel Starting soon' });
    expect(blocked).toBeDisabled();
    expect(blocked).toHaveAttribute('title', 'Cancellations close 1 hour before the start');
    expect(blocked).toHaveAccessibleDescription('Cancellations close 1 hour before the start');
  });

  it('cancels an allowed booking through the API', async () => {
    vi.mocked(api.myBookings).mockResolvedValue([booking()]);
    vi.mocked(api.cancelBooking).mockResolvedValue(booking({ status: 'cancelled' }));
    renderInProviders(<MyBookings onBrowse={vi.fn()} />);
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel Design review' }));
    await waitFor(() => expect(api.cancelBooking).toHaveBeenCalledWith('b1'));
  });
});

describe('AdminRooms', () => {
  it('blocks non-admin users with a notice', async () => {
    renderInProviders(<AdminRooms />);
    expect(await screen.findByText('⚠ Admin access is required to manage rooms.')).toBeInTheDocument();
    expect(api.listRooms).not.toHaveBeenCalled();
  });

  it('adds a room through the modal', async () => {
    vi.mocked(api.me).mockResolvedValue(admin);
    vi.mocked(api.listRooms).mockResolvedValue([hudson]);
    vi.mocked(api.createRoom).mockResolvedValue(hudson);
    const { within } = await import('@testing-library/react');
    renderInProviders(<AdminRooms />);

    await userEvent.click(await screen.findByRole('button', { name: 'Add room' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add room' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await userEvent.type(screen.getByLabelText('Name'), 'Keuka');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add room' }));
    await waitFor(() =>
      expect(api.createRoom).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Keuka', active: true }),
      ),
    );
  });
});
