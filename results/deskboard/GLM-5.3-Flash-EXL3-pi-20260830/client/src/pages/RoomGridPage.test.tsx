// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client.js';

const availability = vi.hoisted(() => ({
  roomId: 'r-1',
  date: '2026-09-07',
  slots: [
    { start: '08:00', end: '09:00', available: true },
    { start: '09:00', end: '10:00', available: false, bookingId: 'b-1', bookingTitle: 'Standup' },
    { start: '10:00', end: '11:00', available: true }
  ]
}));

vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      rooms: vi.fn().mockResolvedValue([
        {
          id: 'r-1',
          name: 'Kiwi',
          capacity: 6,
          floor: 2,
          features: ['screen'],
          active: true,
          createdAt: 'x'
        }
      ]),
      availability: vi.fn().mockResolvedValue(availability)
    }
  };
});

import { api } from '../api/client.js';
import { RoomGridPage } from './RoomGridPage.js';

describe('RoomGridPage', () => {
  it('renders rooms × slots with busy and empty cells', async () => {
    render(
      <RoomGridPage date="2026-09-07" onDateChange={() => {}} onSlotClick={() => {}} />
    );

    expect(await screen.findByRole('columnheader', { name: 'Room' })).toBeInTheDocument();
    expect(screen.getByText('Standup')).toBeInTheDocument(); // busy cell
    expect(screen.getByRole('button', { name: 'Book Kiwi at 08:00' })).toBeInTheDocument();
  });

  it('clicking an empty slot opens the prefilled booking form', async () => {
    const onSlotClick = vi.fn();
    render(
      <RoomGridPage date="2026-09-07" onDateChange={() => {}} onSlotClick={onSlotClick} />
    );
    await userEvent.click(await screen.findByRole('button', { name: 'Book Kiwi at 08:00' }));
    expect(onSlotClick).toHaveBeenCalledWith('r-1', '08:00');
  });

  it('shows an error state with retry when the API fails', async () => {
    vi.mocked(api.rooms).mockRejectedValue(new ApiError('INTERNAL', 'boom', 500));
    render(
      <RoomGridPage date="2026-09-07" onDateChange={() => {}} onSlotClick={() => {}} />
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();

    // Recovery: rooms list comes back, then the second retry recovers the grid fetch
    vi.mocked(api.rooms).mockResolvedValue([
      { id: 'r-1', name: 'Kiwi', capacity: 6, floor: 2, features: [], active: true, createdAt: 'x' }
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
    // The grid fetcher failed before recovery too — retry once more
    await waitFor(async () => {
      const alerts = screen.queryAllByRole('alert');
      if (alerts.length > 0) {
        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));
      }
    });
    await waitFor(
      () => expect(screen.getByRole('columnheader', { name: 'Room' })).toBeInTheDocument(),
      { timeout: 3000 }
    );
  });
});
