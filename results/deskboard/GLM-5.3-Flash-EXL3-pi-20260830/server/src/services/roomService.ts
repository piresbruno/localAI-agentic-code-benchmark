/**
 * Room service — admin-only management rules and the availability grid.
 */
import {
  forbidden,
  notFound,
  AppError,
  type PublicUser,
  type Room,
  type RoomInput,
  type AvailabilityResponse,
  type AvailabilitySlot
} from 'deskboard-shared';
import type { BookingRepository, RoomRepository } from '../repositories/types.js';
import type { Clock, IdGen } from './clock.js';
import { dayOf, timeOfDay } from './time.js';

const SLOT_STARTS = ['08:00', '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00', '17:00', '18:00'];

export const isAdmin = (actor: { role: PublicUser['role'] }): boolean => actor.role === 'admin';

export class RoomService {
  readonly #rooms: RoomRepository;
  readonly #bookings: BookingRepository;
  readonly #clock: Clock;
  readonly #ids: IdGen;

  constructor(deps: {
    rooms: RoomRepository;
    bookings: BookingRepository;
    clock: Clock;
    ids: IdGen;
  }) {
    this.#rooms = deps.rooms;
    this.#bookings = deps.bookings;
    this.#clock = deps.clock;
    this.#ids = deps.ids;
  }

  list(): Room[] {
    return this.#rooms.list();
  }

  getById(roomId: string): Room {
    const room = this.#rooms.findById(roomId);
    if (!room) throw notFound('Room not found');
    return room;
  }

  create(actor: { role: PublicUser['role'] }, input: RoomInput): Room {
    this.#assertAdmin(actor);
    this.#assertNameFree(input.name);
    return this.#rooms.create({
      id: this.#ids.next(),
      name: input.name,
      capacity: input.capacity,
      floor: input.floor,
      features: input.features,
      active: true,
      createdAt: this.#clock.now().toISOString()
    });
  }

  update(
    actor: { role: PublicUser['role'] },
    roomId: string,
    patch: Partial<RoomInput>
  ): Room {
    this.#assertAdmin(actor);
    const room = this.getById(roomId);
    if (patch.name !== undefined && patch.name.toLowerCase() !== room.name.toLowerCase()) {
      this.#assertNameFree(patch.name);
    }
    return this.#rooms.save({ ...room, ...patch });
  }

  /** DELETE /rooms/:id — soft-deactivate. Blocks new bookings, not existing ones. */
  deactivate(actor: { role: PublicUser['role'] }, roomId: string): Room {
    this.#assertAdmin(actor);
    const room = this.getById(roomId);
    return this.#rooms.save({ ...room, active: false });
  }

  /** Free/busy grid for one room on one date, hourly 08:00–19:00. */
  availability(roomId: string, date: string): AvailabilityResponse {
    const room = this.getById(roomId);
    const dayBookings = this.#bookings.list({ roomId, date }).filter((b) => dayOf(b.start) === date);
    const slots: AvailabilitySlot[] = SLOT_STARTS.map((start, i) => {
      const end = SLOT_STARTS[i + 1] ?? '19:00';
      const busy = dayBookings.find(
        (b) => timeOfDay(b.start) < end && timeOfDay(b.end) > start
      );
      return busy
        ? { start, end, available: false, bookingId: busy.id, bookingTitle: busy.title }
        : { start, end, available: true };
    });
    return { roomId: room.id, date, slots };
  }

  #assertAdmin(actor: { role: PublicUser['role'] }): void {
    if (!isAdmin(actor)) throw forbidden('Only admins can manage rooms');
  }

  #assertNameFree(name: string): void {
    const existing = this.#rooms.findByNameIgnoreCase(name);
    if (existing) {
      throw new AppError('DUPLICATE_ROOM_NAME', 'A room with that name already exists', {
        existingRoomId: existing.id
      });
    }
  }
}
