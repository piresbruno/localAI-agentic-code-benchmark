/**
 * Client-side booking logic that mirrors the server rules. Kept separate from
 * components so it is unit-testable. The server stays the source of truth;
 * these helpers drive the UI (free-slot highlighting, prefilled forms).
 */
import type { AvailabilityResponse, BookingResponse, Feature } from 'shared';
import {
  BUSINESS_HOURS,
  BOOKING_DURATIONS_MINUTES,
  CANCELLATION_WINDOW_MINUTES,
  MAX_BOOKING_HOURS,
} from 'shared';

export const HOURS = Array.from(
  { length: BUSINESS_HOURS.end - BUSINESS_HOURS.start },
  (_, i) => BUSINESS_HOURS.start + i,
);

/** Format a Date as local YYYY-MM-DD (for ?date= params). */
export function toLocalDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** "HH:MM" → Date on the given local calendar day. */
export function timeOnDate(date: string, hhmm: string): Date {
  const [h, m] = hhmm.split(':').map(Number);
  const [y, mo, d] = date.split('-').map(Number);
  return new Date(y!, mo! - 1, d!, h!, m!, 0, 0);
}

/** Local Date → ISO string for the API (minute precision enforced by server). */
export function dateTimeToIso(date: string, hhmm: string): string {
  return timeOnDate(date, hhmm).toISOString();
}

export function formatHour(hour: number): string {
  return `${String(hour).padStart(2, '0')}:00`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const date = toLocalDateString(d);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${date} ${hh}:${mm}`;
}

/** Number of consecutive one-hour slots a duration occupies in an hourly grid. */
export function slotsNeeded(durationMinutes: number): number {
  if (durationMinutes <= 60) return 1;
  return 2;
}

/** True when the `durationMinutes` starting at `hour` fits in consecutive free slots. */
export function canBookAt(
  availability: AvailabilityResponse,
  hour: number,
  durationMinutes: number,
): boolean {
  const needed = slotsNeeded(durationMinutes);
  const startIndex = HOURS.indexOf(hour);
  if (startIndex === -1) return false;
  for (let i = 0; i < needed; i++) {
    const slot = availability.slots[startIndex + i];
    if (!slot || slot.status !== 'free') return false;
  }
  return true;
}

export const DURATION_OPTIONS: readonly number[] = BOOKING_DURATIONS_MINUTES as readonly number[];

export const MAX_DURATION_MINUTES = MAX_BOOKING_HOURS * 60;

export function isBusinessDay(date: Date): boolean {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/** Organizer can cancel up to 1h before start (mirrors the server rule). */
export function canCancelBooking(booking: Pick<BookingResponse, 'start'>, now: Date): boolean {
  const start = new Date(booking.start).getTime();
  return start - now.getTime() > CANCELLATION_WINDOW_MINUTES * 60_000;
}

/** Cancel tooltip text when the window is closed. */
export function cancelWindowHint(booking: Pick<BookingResponse, 'start'>): string {
  return `Cancellation closes 1 hour before start (${formatDateTime(booking.start)})`;
}

/** Half-hour start options within business hours (last start: 18:30). */
export function startTimeOptions(): string[] {
  const options: string[] = [];
  const pad = (n: number) => String(n).padStart(2, '0');
  for (let h = BUSINESS_HOURS.start; h < BUSINESS_HOURS.end; h++) {
    options.push(`${pad(h)}:00`);
    options.push(`${pad(h)}:30`);
  }
  return options;
}

export function isActive(room: { active: boolean }): boolean {
  return room.active;
}

export function featureLabel(feature: Feature): string {
  const labels: Record<Feature, string> = {
    screen: 'Screen',
    whiteboard: 'Whiteboard',
    videoconf: 'Video conferencing',
    phone: 'Conference phone',
  };
  return labels[feature];
}
