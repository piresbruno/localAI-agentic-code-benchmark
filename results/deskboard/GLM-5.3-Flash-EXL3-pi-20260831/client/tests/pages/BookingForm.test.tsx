import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ApiError, api } from '../../src/api/client';
import { ToastProvider } from '../../src/components/ui/Toast';
import { BookingForm } from '../../src/pages/BookingForm';
import type { RoomDto } from '@deskboard/shared';
import { WED } from '../fixtures';

vi.mock('../../src/api/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../src/api/client')>();
  return {
    ...actual,
    api: { ...actual.api, rooms: vi.fn(), createBooking: vi.fn() },
  };
});

const room: RoomDto = { id: 'r1', name: 'Fjord', capacity: 8, floor: 3, features: ['screen'], active: true };

function renderForm(search = '?roomId=r1&date=2026-09-02&start=11:00') {
  return render(
    <MemoryRouter initialEntries={[`/book${search}`]}>
      <ToastProvider>
        <Routes>
          <Route path="/book" element={<BookingForm />} />
          <Route path="/my" element={<p>my bookings</p>} />
        </Routes>
      </ToastProvider>
    </MemoryRouter>,
  );
}

describe('BookingForm', () => {
  it('submits a booking with the computed end time and navigates on success', async () => {
    vi.mocked(api.rooms).mockResolvedValue([room]);
    vi.mocked(api.createBooking).mockResolvedValue({
      id: 'b1',
      roomId: 'r1',
      roomName: 'Fjord',
      title: 'Sprint sync',
      organizerId: 'u1',
      organizerName: 'Emma',
      start: `${WED}T11:00`,
      end: `${WED}T12:00`,
      status: 'confirmed',
      attendees: 4,
      createdAt: `${WED}T10:00`,
    });
    renderForm();
    const title = await screen.findByLabelText('Title');
    await userEvent.type(title, 'Sprint sync');
    const attendees = screen.getByLabelText('Attendees');
    await userEvent.clear(attendees);
    await userEvent.type(attendees, '4');
    await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
    await waitFor(() => expect(api.createBooking).toHaveBeenCalledOnce());
    expect(api.createBooking).toHaveBeenCalledWith({
      roomId: 'r1',
      title: 'Sprint sync',
      start: `${WED}T11:00`,
      end: `${WED}T12:00`, // 60-minute duration from the prefilled 11:00 start
      attendees: 4,
    });
    expect(await screen.findByText('my bookings')).toBeInTheDocument();
  });

  it('displays conflict errors from the API error contract inline', async () => {
    vi.mocked(api.rooms).mockResolvedValue([room]);
    vi.mocked(api.createBooking).mockRejectedValue(
      new ApiError('ROOM_CONFLICT', 409, 'This room is already booked for the selected time.'),
    );
    renderForm();
    await userEvent.type(await screen.findByLabelText('Title'), 'Sprint sync');
    await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This room is already booked for the selected time.',
    );
  });

  it('warns when attendees exceed the room capacity before submitting', async () => {
    vi.mocked(api.rooms).mockResolvedValue([room]);
    renderForm();
    const attendeesInput = await screen.findByLabelText('Attendees');
    await userEvent.clear(attendeesInput);
    await userEvent.type(attendeesInput, '9');
    expect(await screen.findByRole('alert')).toHaveTextContent('This room fits 8 attendees.');
    await userEvent.click(screen.getByRole('button', { name: 'Create booking' }));
    expect(api.createBooking).not.toHaveBeenCalled();
  });

  it('locks the room field when prefilled from the grid', async () => {
    vi.mocked(api.rooms).mockResolvedValue([room]);
    renderForm();
    expect(await screen.findByLabelText('Room')).toBeDisabled();
  });
});
