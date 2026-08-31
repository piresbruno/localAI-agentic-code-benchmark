import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Room } from '@deskboard/shared';

vi.mock('../src/api/client.js', () => {
  class ApiError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
      readonly details?: unknown,
    ) {
      super(message);
    }
    get fieldErrors(): Record<string, string[]> {
      return typeof this.details === 'object' && this.details !== null
        ? (this.details as Record<string, string[]>)
        : {};
    }
  }
  return {
    ApiError,
    setAuthToken: vi.fn(),
    api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), del: vi.fn() },
  };
});

import { api } from '../src/api/client.js';
import { BookingFormPage } from '../src/pages/BookingFormPage.js';
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
  features: [],
  active: true,
};

function renderForm(over = {}) {
  return render(
    <ToastProvider>
      <BookingFormPage
        rooms={[room]}
        prefill={null}
        onDone={() => {}}
        onCancel={() => {}}
        {...over}
      />
    </ToastProvider>,
  );
}

describe('BookingFormPage', () => {
  it('fills the form and submits the computed booking to the API', async () => {
    const user = userEvent.setup();
    const onDone = vi.fn();
    mockApi.post.mockResolvedValue({ id: 'b1' } as never);
    renderForm({ onDone });

    await user.type(screen.getByLabelText('Title'), 'Sprint planning');
    await user.type(screen.getByLabelText('Date'), '2026-09-01');
    await user.selectOptions(screen.getByLabelText('Duration'), '90');
    await user.clear(screen.getByLabelText('Attendees'));
    await user.type(screen.getByLabelText('Attendees'), '6');

    await user.click(screen.getByRole('button', { name: 'Create booking' }));

    await waitFor(() => expect(mockApi.post).toHaveBeenCalledTimes(1));
    expect(mockApi.post).toHaveBeenCalledWith('/bookings', {
      roomId: 'r1',
      title: 'Sprint planning',
      start: '2026-09-01T09:00',
      end: '2026-09-01T10:30',
      attendees: 6,
    });
    expect(onDone).toHaveBeenCalled();
  });

  it('locks the room field when prefilled and shows the prefilled slot', async () => {
    renderForm({
      prefill: { roomId: 'r1', date: '2026-09-01', startTime: '10:00' },
    });
    const roomSelect = screen.getByLabelText('Room') as HTMLSelectElement;
    expect(roomSelect).toBeDisabled();
    expect((screen.getByLabelText('Date') as HTMLInputElement).value).toBe('2026-09-01');
    expect((screen.getByLabelText('Start time') as HTMLSelectElement).value).toBe('10:00');
  });

  it('shows client-side validation errors without calling the API', async () => {
    const user = userEvent.setup();
    renderForm();
    await user.click(screen.getByRole('button', { name: 'Create booking' }));
    expect(await screen.findByText('Title is required')).toBeInTheDocument();
    expect(mockApi.post).not.toHaveBeenCalled();
  });

  it('surfaces API rule violations inline with the shared error message', async () => {
    const user = userEvent.setup();
    mockApi.post.mockRejectedValue(
      new (await import('../src/api/client.js')).ApiError(
        409,
        'ROOM_CONFLICT',
        'The room is already booked for an overlapping time',
      ),
    );
    renderForm();
    await user.type(screen.getByLabelText('Title'), 'Conflicting');
    await user.type(screen.getByLabelText('Date'), '2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Create booking' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The room is already booked for an overlapping time',
    );
  });

  it('shows a success toast after a successful booking', async () => {
    const user = userEvent.setup();
    mockApi.post.mockResolvedValue({ id: 'b1' } as never);
    renderForm();
    await user.type(screen.getByLabelText('Title'), 'OK meeting');
    await user.type(screen.getByLabelText('Date'), '2026-09-01');
    await user.click(screen.getByRole('button', { name: 'Create booking' }));
    expect(await screen.findByTestId('toast')).toHaveTextContent('Booking created');
  });
});
