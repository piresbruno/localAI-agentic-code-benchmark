import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@deskboard/shared';

vi.mock('../src/api/client.js', () => ({
  ApiError: class ApiError extends Error {},
  setAuthToken: vi.fn(),
  api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
}));

import { api } from '../src/api/client.js';
import { AdminRoomsPage } from '../src/pages/AdminRoomsPage.js';
import { ToastProvider } from '../src/components/ui/Toast.js';

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
  features: ['screen'],
  active: true,
};

function renderPage() {
  return render(
    <ToastProvider>
      <AdminRoomsPage />
    </ToastProvider>,
  );
}

describe('AdminRoomsPage', () => {
  it('lists rooms in a table with status chips', async () => {
    mockApi.get.mockResolvedValue([room, { ...room, id: 'r2', name: 'Focus Pod', active: false }]);
    renderPage();

    expect(await screen.findByRole('cell', { name: 'Board Room' })).toBeInTheDocument();
    expect(screen.getByRole('cell', { name: 'Focus Pod' })).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('deactivated')).toBeInTheDocument();
  });

  it('opens the add-room modal and creates a room via POST', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([]);
    mockApi.post.mockResolvedValue(room);
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Add room' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add room' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');

    await user.type(within(dialog).getByLabelText('Name'), 'Vitable');
    await user.click(within(dialog).getByRole('button', { name: 'Add room' }));

    await vi.waitFor(() =>
      expect(mockApi.post).toHaveBeenCalledWith(
        '/rooms',
        expect.objectContaining({ name: 'Vitable' }),
      ),
    );
  });

  it('deactivates an active room via DELETE', async () => {
    const user = userEvent.setup();
    mockApi.get.mockResolvedValue([room]);
    mockApi.del.mockResolvedValue({ ...room, active: false });
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Deactivate Board Room' }));
    await vi.waitFor(() => expect(mockApi.del).toHaveBeenCalledWith('/rooms/r1'));
  });

  it('shows the empty state when there are no rooms', async () => {
    mockApi.get.mockResolvedValue([]);
    renderPage();
    expect(await screen.findByText(/No rooms yet — add the first room/i)).toBeInTheDocument();
  });
});
