import type { BookingDto, RoomDto, AvailabilityDto } from '@deskboard/shared';

export interface GridCell {
  kind: 'free' | 'busy';
  booking?: { id: string; title: string };
}

export interface GridRow {
  room: RoomDto;
  /** 11 cells, one per hourly slot 08:00–19:00. */
  cells: GridCell[];
}

export const GRID_HOURS = Array.from({ length: 11 }, (_, i) => 8 + i);

export function hhmm(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

/**
 * Builds the rooms × hours grid (spec §6). Pure: the same inputs always
 * render the same grid — unit-tested in client/tests.
 */
export function buildGrid(rooms: RoomDto[], availability: AvailabilityDto[]): GridRow[] {
  const byRoom = new Map(availability.map((a) => [a.roomId, a]));
  return rooms.map((room) => {
    const slots = byRoom.get(room.id)?.slots ?? [];
    return {
      room,
      cells: GRID_HOURS.map((_, i) => {
        const booking = slots[i]?.booking;
        return booking ? { kind: 'busy' as const, booking } : { kind: 'free' as const };
      }),
    };
  });
}

const CANCELLATION_WINDOW_MS = 60 * 60 * 1000;

/**
 * Client-side mirror of `enforces_cancellation_window`: organizer may cancel
 * up to 1h before start. Admins bypass (handled by callers passing isAdmin).
 */
export function canCancel(booking: Pick<BookingDto, 'start' | 'status'>, now: Date): boolean {
  if (booking.status !== 'confirmed') return false;
  return new Date(booking.start).getTime() - now.getTime() >= CANCELLATION_WINDOW_MS;
}

export interface BookingPartition {
  upcoming: BookingDto[];
  past: BookingDto[];
}

/** Splits own bookings into upcoming (future, not cancelled) and past/everything else. */
export function partitionBookings(bookings: BookingDto[], now: Date): BookingPartition {
  const upcoming: BookingDto[] = [];
  const past: BookingDto[] = [];
  for (const b of bookings) {
    if (b.status !== 'cancelled' && new Date(b.end).getTime() > now.getTime()) {
      upcoming.push(b);
    } else {
      past.push(b);
    }
  }
  const byStart = (a: BookingDto, b: BookingDto) => a.start.localeCompare(b.start);
  return { upcoming: upcoming.sort(byStart), past: past.sort(byStart) };
}

/** Human-friendly `HH:mm – HH:mm` range for a booking. */
export function timeRange(booking: Pick<BookingDto, 'start' | 'end'>): string {
  return `${booking.start.slice(11, 16)} – ${booking.end.slice(11, 16)}`;
}
