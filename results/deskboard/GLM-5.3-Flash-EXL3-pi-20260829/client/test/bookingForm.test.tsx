/** BookingForm behavior tests: fills the form, submits, shows API errors inline. */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Room } from '@deskboard/shared';
import { BookingForm, type BookingFormPrefs } from '../src/components/BookingForm.js';
import { ToastProvider } from '../src/components/ui/Toast.js';

vi.mock('../src/api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/api/client.js')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      createBooking: vi.fn(),
    },
  };
});

import { api, ApiClientError } from '../src/api/client.js';

const rooms: Room[] = [
  { id: 'r1', name: 'Boardroom', capacity: 14, floor: 5, features: ['screen'], active: true, createdAt: '' },
  { id: 'r2', name: 'Pod', capacity: 1, floor: 2, features: [], active: true, createdAt: '' },
  { id: 'r3', name: 'Old Room', capacity: 5, floor: 1, features: [], active: false, createdAt: '' },
];

function renderForm(prefs: BookingFormPrefs | null = null) {
  const onClose = vi.fn();
  const onBooked = vi.fn();
  render(
    <ToastProvider>
      <BookingForm rooms={rooms} prefs={prefs} onClose={onClose} onBooked={onBooked} />
    </ToastProvider>,
  );
  return { onClose, onBooked };
}

beforeEach(() => {
  vi.mocked(api.createBooking).mockReset();
});

afterEach(() => {
  cleanup();
});

describe('BookingForm', () => {
  it('submits a booking with the composed payload and refreshes the grid', async () => {
    vi.mocked(api.createBooking).mockResolvedValue({} as never);
    const { onBooked } = renderForm({ roomId: 'r1', date: '2026-08-31', startTime: '09:00' });

    await userEvent.type(screen.getByLabelText('Title'), 'Sprint planning');
    await userEvent.clear(screen.getByLabelText('Attendees'));
    await userEvent.type(screen.getByLabelText('Attendees'), '5');

    await userEvent.click(screen.getByRole('button', { name: /Book room/ }));

    await waitFor(() => expect(onBooked).toHaveBeenCalled());
    expect(api.createBooking).toHaveBeenCalledWith({
      roomId: 'r1',
      title: 'Sprint planning',
      start: '2026-08-31T09:00',
      end: '2026-08-31T10:00',
      attendees: 5,
      recurrence: { kind: 'none' },
    });
  });

  it('locks the room select when prefilled and excludes deactivated rooms from options', () => {
    renderForm({ roomId: 'r1', date: '2026-08-31', startTime: '09:00' });
    expect(screen.getByLabelText('Room')).toBeDisabled();
    const options = screen.getAllByRole('option') as HTMLOptionElement[];
    expect(options.some((o) => o.textContent.includes('Old Room'))).toBe(false);
  });

  it('sends weekly recurrence when selected', async () => {
    vi.mocked(api.createBooking).mockResolvedValue({} as never);
    renderForm({ roomId: 'r2', date: '2026-08-31', startTime: '10:00' });

    await userEvent.type(screen.getByLabelText('Title'), 'Weekly sync');
    await userEvent.selectOptions(screen.getByLabelText('Repeats'), '3');
    await userEvent.click(screen.getByRole('button', { name: /Book room/ }));

    await waitFor(() =>
      expect(api.createBooking).toHaveBeenCalledWith(
        expect.objectContaining({ recurrence: { kind: 'weekly', count: 3 } }),
      ),
    );
  });

  it('shows the API error message inline (conflict) and does not close', async () => {
    vi.mocked(api.createBooking).mockRejectedValue(
      new ApiClientError(409, 'ROOM_CONFLICT', 'The room is already booked between 2026-08-31T09:00 and 2026-08-31T10:00'),
    );
    const { onClose } = renderForm({ roomId: 'r1', date: '2026-08-31', startTime: '09:00' });

    await userEvent.type(screen.getByLabelText('Title'), 'Clash');
    await userEvent.click(screen.getByRole('button', { name: /Book room/ }));

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent.includes('already booked'))).toBe(true);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('shows validation field errors from the API contract', async () => {
    vi.mocked(api.createBooking).mockRejectedValue(
      new ApiClientError(400, 'VALIDATION_FAILED', 'Attendees must be at least 1', [
        { field: 'attendees', message: 'Attendees must be at least 1' },
      ]),
    );
    renderForm({ roomId: 'r1', date: '2026-08-31', startTime: '09:00' });

    await userEvent.type(screen.getByLabelText('Title'), 'Officer meeting');
    await userEvent.clear(screen.getByLabelText('Attendees'));
    await userEvent.type(screen.getByLabelText('Attendees'), '0');
    await userEvent.click(screen.getByRole('button', { name: /Book room/ }));

    await waitFor(() => expect(screen.getAllByText('Attendees must be at least 1').length).toBeGreaterThan(0));
  });
});
