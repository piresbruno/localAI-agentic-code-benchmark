import { Booking, BUSINESS, Room } from '@deskboard/shared';

/** Bookable slot start hours (local), 08:00 … 18:00 — the grid's columns. */
export const SLOT_HOURS: number[] = Array.from(
  { length: BUSINESS.CLOSE_HOUR - BUSINESS.OPEN_HOUR },
  (_, i) => BUSINESS.OPEN_HOUR + i,
);

export const DURATION_OPTIONS = [30, 60, 90, 120];

/** Bookable start times: every 30 min from 08:00 to 18:30 (last slot ends 19:00). */
export function startTimeOptions(): string[] {
  const out: string[] = [];
  for (
    let minutes = BUSINESS.OPEN_HOUR * 60;
    minutes <= BUSINESS.CLOSE_HOUR * 60 - 30;
    minutes += 30
  ) {
    out.push(hourLabel(Math.floor(minutes / 60), minutes % 60));
  }
  return out;
}

export interface GridSlot {
  start: string; // 'HH:mm'
  end: string;
  available: boolean;
  bookingId?: string;
  title?: string;
}

export interface RoomRow {
  room: Room;
  slots: GridSlot[];
}

const pad = (n: number): string => String(n).padStart(2, '0');

export function hourLabel(hour: number, minutes = 0): string {
  return `${pad(hour)}:${pad(minutes)}`;
}

/** 'YYYY-MM-DDTHH:mm' + minutes → same format, same local day (durations ≤ 4h). */
export function addMinutes(localDateTime: string, minutes: number): string {
  const [day, time] = localDateTime.split('T');
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${day}T${hourLabel(Math.floor(total / 60), total % 60)}`;
}

/** Today's date in local time as 'YYYY-MM-DD' (never UTC-shifted). */
export function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function localDateOf(isoTimestamp: string): string {
  const d = new Date(isoTimestamp);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** Server availability DTO → grid slots (fills any missing hours defensively). */
export function slotsFromAvailability(slots: GridSlot[] | undefined): GridSlot[] {
  const byStart = new Map((slots ?? []).map((slot) => [slot.start, slot]));
  return SLOT_HOURS.map((hour) => {
    const found = byStart.get(hourLabel(hour));
    return (
      found ?? {
        start: hourLabel(hour),
        end: hourLabel(hour + 1),
        available: true,
      }
    );
  });
}

/** Assemble the RoomGrid matrix: active rooms × hourly slots. */
export function buildRoomRows(
  rooms: Room[],
  grids: { roomId: string; slots: GridSlot[] }[],
): RoomRow[] {
  const byRoom = new Map(grids.map((grid) => [grid.roomId, grid.slots]));
  return rooms
    .filter((room) => room.active)
    .map((room) => ({ room, slots: slotsFromAvailability(byRoom.get(room.id)) }));
}

/**
 * UI mirror of the server's cancellation window (spec §4): the organizer may
 * cancel up to 1h before start; admins anytime. Used for the disabled state;
 * the server remains the authority.
 */
export function canCancel(
  booking: Pick<Booking, 'start' | 'status'>,
  now: Date,
  isAdmin = false,
): boolean {
  if (booking.status === 'cancelled' || isAdmin) return booking.status !== 'cancelled';
  return now.getTime() <= new Date(booking.start).getTime() - BUSINESS.CANCEL_WINDOW_MIN * 60_000;
}

/** Human reason why a booking cannot be cancelled right now, or null if it can. */
export function cancellationBlocker(
  booking: Pick<Booking, 'start' | 'status'>,
  now: Date,
  isAdmin = false,
): string | null {
  if (booking.status === 'cancelled') return 'Already cancelled';
  if (isAdmin) return null;
  const deadline = new Date(booking.start).getTime() - BUSINESS.CANCEL_WINDOW_MIN * 60_000;
  return now.getTime() > deadline ? 'Cancellations close 1 hour before the start' : null;
}

/** 'Mon, Sep 1 · 09:00–10:00' for list rendering (locale-stable, en-US). */
export function formatBookingRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const day = start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const time = (d: Date) => hourLabel(d.getHours(), d.getMinutes());
  return `${day} · ${time(start)}–${time(end)}`;
}
