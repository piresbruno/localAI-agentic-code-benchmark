/** Room business rules: CRUD (admin only), case-insensitive name uniqueness, deactivation. */
import type { PublicUser, Room, RoomFeature } from '@deskboard/shared';
import { conflictError, forbiddenError, notFoundError } from '@deskboard/shared';
import type { RoomRepository } from '../repositories/types.js';
import type { Clock, IdGen } from './clock.js';

export interface RoomServiceDeps {
  rooms: RoomRepository;
  clock: Clock;
  idGen: IdGen;
}

export interface CreateRoomInput {
  name: string;
  capacity: number;
  floor: number;
  features: RoomFeature[];
  active: boolean;
}

export type UpdateRoomInput = Partial<CreateRoomInput>;

export class RoomService {
  private readonly rooms: RoomRepository;
  private readonly clock: Clock;
  private readonly idGen: IdGen;

  constructor(deps: RoomServiceDeps) {
    this.rooms = deps.rooms;
    this.clock = deps.clock;
    this.idGen = deps.idGen;
  }

  /** All rooms, newest first. Visible to any authenticated user. */
  list(): Room[] {
    return this.rooms.findAll().sort((a, b) => a.name.localeCompare(b.name));
  }

  get(id: string): Room {
    const room = this.rooms.findById(id);
    if (!room) throw notFoundError('Room not found');
    return room;
  }

  /** Creates a room. Admin only; names are unique case-insensitively. */
  create(actor: PublicUser, input: CreateRoomInput): Room {
    this.assertAdmin(actor);
    this.assertNameAvailable(input.name);
    const room: Room = {
      id: this.idGen.next(),
      name: input.name.trim(),
      capacity: input.capacity,
      floor: input.floor,
      features: [...input.features],
      active: input.active,
      createdAt: this.clock.now().toISOString(),
    };
    this.rooms.create(room);
    return room;
  }

  /** Updates a room. Admin only. Name uniqueness excludes the room itself. */
  update(actor: PublicUser, id: string, input: UpdateRoomInput): Room {
    this.assertAdmin(actor);
    const room = this.get(id);
    if (input.name !== undefined && input.name.trim().toLowerCase() !== room.name.toLowerCase()) {
      this.assertNameAvailable(input.name);
    }
    const updated: Room = {
      ...room,
      name: input.name !== undefined ? input.name.trim() : room.name,
      capacity: input.capacity !== undefined ? input.capacity : room.capacity,
      floor: input.floor !== undefined ? input.floor : room.floor,
      features: input.features !== undefined ? [...input.features] : room.features,
      active: input.active !== undefined ? input.active : room.active,
    };
    this.rooms.update(updated);
    return updated;
  }

  /**
   * Soft-deactivates a room (DELETE semantics). Deactivation blocks new bookings
   * but never touches existing ones.
   */
  deactivate(actor: PublicUser, id: string): Room {
    this.assertAdmin(actor);
    const room = this.get(id);
    const updated: Room = { ...room, active: false };
    this.rooms.update(updated);
    return updated;
  }

  private assertAdmin(actor: PublicUser): void {
    if (actor.role !== 'admin') {
      throw forbiddenError('Only admins can manage rooms');
    }
  }

  private assertNameAvailable(name: string): void {
    if (this.rooms.findByNameIgnoreCase(name.trim())) {
      throw conflictError('CONFLICT', 'A room with this name already exists');
    }
  }
}
