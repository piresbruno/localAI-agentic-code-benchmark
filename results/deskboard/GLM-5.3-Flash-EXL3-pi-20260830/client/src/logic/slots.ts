/**
 * Slot/grid computation for the RoomGrid. Pure functions — unit tested.
 * Business knowledge used here: slots run 08:00–19:00 hourly (spec §6).
 */
import type { AvailabilitySlot } from 'deskboard-shared';

export const GRID_START_HOUR = 8;
export const GRID_END_HOUR = 19;

/** '2026-09-07T10:30' → '10:30'; '10:30' → '10:30'. */
export const timeLabel = (isoOrTime: string): string => isoOrTime.slice(11) || isoOrTime;

export const todayIso = (now = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
};

/** Hourly slot labels 08:00 … 18:00 (the 18:00 slot ends at 19:00). */
export const gridSlotStarts = (): string[] => {
  const starts: string[] = [];
  for (let h = GRID_START_HOUR; h < GRID_END_HOUR; h++) {
    starts.push(`${String(h).padStart(2, '0')}:00`);
  }
  return starts;
};

/** True when the slot is bookable (empty and the room grid allows clicking). */
export const isSlotClickable = (slot: AvailabilitySlot): boolean => slot.available;

/**
 * Cancellation rule (mirrors the server for UI feedback only — the API is the
 * authority): organizer may cancel up to 1h before start; admin anytime.
 */
export const canCancelBooking = (
  booking: { status: string; start: string; organizer: { id: string } },
  viewer: { id: string; role: 'admin' | 'employee' },
  now = new Date()
): boolean => {
  if (booking.status !== 'confirmed') return false;
  if (viewer.role === 'admin') return true;
  if (booking.organizer.id !== viewer.id) return false;
  const start = new Date(booking.start).getTime();
  return start - now.getTime() >= 60 * 60 * 1000;
};

export const cancellationTooltip = (
  booking: { status: string; start: string; organizer: { id: string } },
  viewer: { id: string; role: 'admin' | 'employee' },
  now = new Date()
): string => {
  if (canCancelBooking(booking, viewer, now)) return 'Cancel this booking';
  if (booking.status === 'cancelled') return 'Already cancelled';
  if (booking.status === 'completed') return 'This booking has already happened';
  if (viewer.role !== 'admin' && booking.organizer.id !== viewer.id)
    return 'Only the organizer or an admin can cancel';
  return 'Cancellations are only possible up to 1 hour before start';
};

/** Splits bookings into upcoming (not yet ended) and past. */
export const splitUpcomingPast = <T extends { end: string; status: string }>(
  bookings: T[],
  now = new Date()
): { upcoming: T[]; past: T[] } => {
  const nowMs = now.getTime();
  return {
    upcoming: bookings.filter((b) => new Date(b.end).getTime() > nowMs && b.status !== 'cancelled'),
    past: bookings.filter((b) => new Date(b.end).getTime() <= nowMs || b.status === 'cancelled')
  };
};

export const formatDateHuman = (dateIso: string): string => {
  const d = new Date(`${dateIso}T12:00`);
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};
