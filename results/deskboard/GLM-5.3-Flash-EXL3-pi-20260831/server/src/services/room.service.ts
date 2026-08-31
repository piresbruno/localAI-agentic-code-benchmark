import type { RoomDto } from '@deskboard/shared';
import type { RoomCreateInput, RoomUpdateInput } from '@deskboard/shared';
import type { IdGen } from './clock';
import { conflict, forbidden, notFound } from './errors';
import type { AuthUser } from '../auth/jwt';
import type { RoomEntity, RoomRepository } from '../repositories/types';

/** Room catalogue: admin-only mutations, case-insensitive unique names, soft deactivation. */
export class RoomService {
  constructor(private rooms: RoomRepository, private ids: IdGen) {}

  list(): RoomDto[] {
    return this.rooms.all().map(toRoomDto);
  }

  create(actor: AuthUser, input: RoomCreateInput): RoomDto {
    requireAdmin(actor);
    assertNameFree(this.rooms, input.name);
    const room: RoomEntity = { id: this.ids.next(), ...input };
    return toRoomDto(this.rooms.create(room));
  }

  update(actor: AuthUser, id: string, input: RoomUpdateInput): RoomDto {
    requireAdmin(actor);
    const room = this.rooms.findById(id);
    if (!room) throw notFound('Room');
    if (input.name !== undefined) {
      const clash = this.rooms.findByName(input.name);
      if (clash && clash.id !== id) {
        throw conflict('ROOM_NAME_TAKEN', 'A room with this name already exists.');
      }
    }
    return toRoomDto(this.rooms.update({ ...room, ...input }));
  }

  /** Soft-deactivate: the room stays listed but rejects new bookings. */
  deactivate(actor: AuthUser, id: string): RoomDto {
    requireAdmin(actor);
    const room = this.rooms.findById(id);
    if (!room) throw notFound('Room');
    return toRoomDto(this.rooms.update({ ...room, active: false }));
  }
}

export function toRoomDto(room: RoomEntity): RoomDto {
  return { ...room };
}

export function requireAdmin(actor: AuthUser): void {
  if (actor.role !== 'admin') throw forbidden('Admin role required.');
}

function assertNameFree(rooms: RoomRepository, name: string): void {
  if (rooms.findByName(name)) {
    throw conflict('ROOM_NAME_TAKEN', 'A room with this name already exists.');
  }
}
