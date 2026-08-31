import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { api } from '../../src/api/client';
import { AuthProvider } from '../../src/hooks/useAuth';
import { ToastProvider } from '../../src/components/ui/Toast';
import { AdminRooms } from '../../src/pages/AdminRooms';
import type { RoomDto } from '@deskboard/shared';

vi.mock('../../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/client')>();
  return {
    ...actual,
    api: { ...actual.api, me: vi.fn(), rooms: vi.fn(), createRoom: vi.fn(), updateRoom: vi.fn(), deactivateRoom: vi.fn() },
  };
});

const room: RoomDto = { id: 'r1', name: 'Fjord', capacity: 8, floor: 3, features: ['screen'], active: true };

/** Admin-only page: seed an admin token so AuthProvider restores the admin user. */
async function renderAsAdmin() {
  localStorage.setItem('deskboard.token', 'admin-token');
  vi.mocked(api.me).mockResolvedValue({ id: 'a1', name: 'Admin', email: 'a@test.local', role: 'admin' });
  const view = render(
    <MemoryRouter>
      <AuthProvider>
        <ToastProvider>
          <AdminRooms />
        </ToastProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
  await waitFor(() => expect(vi.mocked(api.me)).toHaveBeenCalled());
  return view;
}

describe('AdminRooms', () => {
  it('renders the room table with statuses and actions for admins', async () => {
    vi.mocked(api.rooms).mockResolvedValue([room]);
    await renderAsAdmin();
    expect(await screen.findByRole('cell', { name: 'Fjord' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Deactivate Fjord' })).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
  });

  it('opens the add-room modal and creates a room via the API', async () => {
    vi.mocked(api.rooms).mockResolvedValue([room]);
    vi.mocked(api.createRoom).mockResolvedValue(room);
    await renderAsAdmin();
    await userEvent.click(await screen.findByRole('button', { name: 'Add room' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add room' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    await userEvent.type(screen.getByLabelText('Name'), 'Boardroom');
    await userEvent.click(screen.getByRole('button', { name: 'Create room' }));
    await waitFor(() =>
      expect(api.createRoom).toHaveBeenCalledWith({ name: 'Boardroom', capacity: 6, floor: 1, features: [] }),
    );
    expect(await screen.findByTestId('toast')).toHaveTextContent('Room created.');
  });

  it('deactivates a room via the API and confirms with a toast', async () => {
    vi.mocked(api.rooms).mockResolvedValue([room]);
    vi.mocked(api.deactivateRoom).mockResolvedValue({ ...room, active: false });
    await renderAsAdmin();
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate Fjord' }));
    await waitFor(() => expect(api.deactivateRoom).toHaveBeenCalledWith('r1'));
    expect(await screen.findByTestId('toast')).toHaveTextContent('Room “Fjord” deactivated.');
  });

  it('shows the empty state when no rooms exist', async () => {
    vi.mocked(api.rooms).mockResolvedValue([]);
    await renderAsAdmin();
    expect(await screen.findByText('No rooms yet — add the first one.')).toBeInTheDocument();
  });
});
