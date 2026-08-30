// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider } from '../components/ui/Toast.jsx';
import { ApiError } from '../api/client.js';

const rooms = vi.hoisted(() => [
  { id: 'r-1', name: 'Kiwi', capacity: 6, floor: 2, features: ['screen'], active: true, createdAt: 'x' }
]);

vi.mock('../api/client.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../api/client.js')>();
  return {
    ...actual,
    api: {
      ...actual.api,
      rooms: vi.fn().mockResolvedValue(rooms),
      createBooking: vi.fn()
    }
  };
});

import { api } from '../api/client.js';
import { BookingFormPage } from './BookingFormPage.js';

const renderForm = (onBooked = () => {}) =>
  render(
    <ToastProvider>
      <BookingFormPage
        prefill={{ roomId: 'r-1', date: '2026-09-07', startTime: '09:00' }}
        onBooked={onBooked}
      />
    </ToastProvider>
  );

describe('BookingFormPage', () => {
  beforeEach(() => {
    vi.mocked(api.createBooking).mockReset();
    vi.mocked(api.createBooking).mockResolvedValue([]);
  });

  it('submits a valid booking and navigates on success', async () => {
    const onBooked = vi.fn();
    renderForm(onBooked);

    const title = await screen.findByLabelText('Title');
    await userEvent.type(title, 'Kickoff');
    const attendees = screen.getByLabelText('Attendees');
    await userEvent.clear(attendees);
    await userEvent.type(attendees, '4');

    await userEvent.click(screen.getByRole('button', { name: /create booking/i }));

    await waitFor(() => expect(api.createBooking).toHaveBeenCalledOnce());
    expect(api.createBooking).toHaveBeenCalledWith({
      roomId: 'r-1',
      title: 'Kickoff',
      start: '2026-09-07T09:00',
      durationMinutes: 60,
      attendees: 4,
      recurrence: { kind: 'none' }
    });
    await waitFor(() => expect(onBooked).toHaveBeenCalledOnce());
    expect(await screen.findByText('Booking created')).toBeInTheDocument();
  });

  it('shows inline validation errors and does not call the API', async () => {
    renderForm();
    await userEvent.click(await screen.findByRole('button', { name: /create booking/i }));
    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0);
    });
    expect(
      screen.getAllByRole('alert').some((el) => /at least 1 character|required/i.test(el.textContent ?? ''))
    ).toBe(true);
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it('displays API conflict errors inline', async () => {
    vi.mocked(api.createBooking).mockRejectedValue(
      new ApiError('ROOM_CONFLICT', 'The room is already booked for that time', 409)
    );
    renderForm();

    await userEvent.type(await screen.findByLabelText('Title'), 'Overlap');
    await userEvent.click(screen.getByRole('button', { name: /create booking/i }));

    const matches = await screen.findAllByText(/already booked/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('locks the room field when prefilled from the grid', async () => {
    renderForm();
    const roomSelect = await screen.findByLabelText('Room');
    expect(roomSelect).toBeDisabled();
  });
});
