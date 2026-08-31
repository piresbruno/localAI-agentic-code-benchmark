/** Time helpers over naive local ISO-8601 strings (`YYYY-MM-DDTHH:mm`). */

export function parseLocal(iso: string): Date {
  return new Date(iso);
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function hhmm(hours: number): string {
  return `${String(hours).padStart(2, '0')}:00`;
}

/** Business day window: Mon–Fri 08:00–19:00 local. */
export const BUSINESS_OPEN_MIN = 8 * 60;
export const BUSINESS_CLOSE_MIN = 19 * 60;
export const MAX_DURATION_MIN = 4 * 60;
export const CANCELLATION_WINDOW_MIN = 60;

/** True when both instants fall inside one weekday's business window. */
export function isWithinBusinessHours(start: Date, end: Date): boolean {
  const sameDay = start.toDateString() === end.toDateString();
  const weekday = start.getDay() >= 1 && start.getDay() <= 5;
  return (
    sameDay &&
    weekday &&
    minutesOfDay(start) >= BUSINESS_OPEN_MIN &&
    minutesOfDay(end) <= BUSINESS_CLOSE_MIN
  );
}
