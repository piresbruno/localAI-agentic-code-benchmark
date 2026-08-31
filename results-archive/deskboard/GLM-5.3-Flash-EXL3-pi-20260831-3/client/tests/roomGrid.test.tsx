import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { BookingDto, Room } from '@deskboard/shared';

vi.mock('../src/api/client.js', () => ({
  ApiError: class ApiError extends Error {},
  setAuthToken: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

import { api } from '../src/api/client.js';
import { RoomGridPage } from '../src/pages/RoomGridPage.js';

const mockApi = vi.mocked(api, true);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const room: Room = {
  id: 'r1',
  name: 'Board Room',
  capacity: 10,
  floor: 3,
  features: [],
  active: true,
};

const booking: BookingDto = {
  id: 'b1',
  roomId: 'r1',
  roomName: 'Board Room',
  title: 'Sprint planning',
  organizerId: 'u1',
  start: '2026-09-01T09:00',
  end: '2026-09-01T10:00',
  status: 'confirmed',
  attendees: 4,
  createdAt: '2026-08-31T10:00',
};

function renderGrid(date = '2026-09-01') {
  const onBookSlot = vi.fn();
  render(
    <RoomGridPage
      date={date}
      onDateChange={() => {}}
      onBookSlot={onBookSlot}
      onGridChanged={() => {}}
      refreshKey={0}
    />,
  );
  return { onBookSlot };
}

describe('RoomGridPage', () => {
  it('renders the room rows and the 11 hourly slot columns', async () => {
    mockApi.get.mockResolvedValueOnce([room]).mockResolvedValueOnce([booking]);
    renderGrid();

    expect(await screen.findByRole('columnheader', { name: 'Room' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '08:00' })).toBeInTheDocument();
    expect(screen.getByRole('columnheader', { name: '18:00' })).toBeInTheDocument();
    expect(screen.getByText('Board Room')).toBeInTheDocument();
  });

  it('shows booked slots with title + attendees and free slots as buttons', async () => {
    mockApi.get.mockResolvedValueOnce([room]).mockResolvedValueOnce([booking]);
    renderGrid();

    expect(await screen.findByText('Sprint planning')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Book Board Room at 08:00' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Book Board Room at 09:00' }),
    ).not.toBeInTheDocument();
  });

  it('opens the prefilled booking form when an empty slot is clicked', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValueOnce([room]).mockResolvedValueOnce([booking]);
    const { onBookSlot } = renderGrid();

    await user.click(await screen.findByRole('button', { name: 'Book Board Room at 08:00' }));
    expect(onBookSlot).toHaveBeenCalledWith('r1', '2026-09-01', '08:00');
  });

  it('shows the error state with a retry action when the API fails', async () => {
    mockApi.get.mockRejectedValue(new Error('Network down'));
    renderGrid();

    expect(await screen.findByRole('alert')).toHaveTextContent(/Something went wrong/i);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});
