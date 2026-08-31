import type { AvailabilityDto, AvailabilitySlotDto } from '@deskboard/shared';
import { notFound } from './errors';
import type { BookingRepository, RoomRepository } from '../repositories/types';
import { hhmm, parseLocal } from './time';

const OPEN_HOUR = 8;
const CLOSE_HOUR = 19;
const SLOT_COUNT = CLOSE_HOUR - OPEN_HOUR; // 11 hourly slots 08:00–19:00

/** Builds the free/busy grid for one room and one day (spec §5). */
export class AvailabilityService {
  constructor(private rooms: RoomRepository, private bookings: BookingRepository) {}

  forRoom(roomId: string, date: string): AvailabilityDto {
    const room = this.rooms.findById(roomId);
    if (!room) throw notFound('Room');
    const slots: AvailabilitySlotDto[] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const hour = OPEN_HOUR + i;
      const slotStart = parseLocal(`${date}T${hhmm(hour)}`);
      const slotEnd = parseLocal(`${date}T${hhmm(hour + 1)}`);
      const busy = this.bookings
        .findByRoom(roomId)
        .find(
          (b) =>
            b.status === 'confirmed' &&
            slotStart < parseLocal(b.end) &&
            slotEnd > parseLocal(b.start),
        );
      slots.push({
        start: hhmm(hour),
        end: hhmm(hour + 1),
        booking: busy ? { id: busy.id, title: busy.title } : null,
      });
    }
    return { roomId, date, slots };
  }
}
