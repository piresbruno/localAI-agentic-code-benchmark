import type { Role, Room, RoomCreateInput, RoomUpdateInput } from '@deskboard/shared';
import type { RoomRepository } from '../repositories/roomRepository.js';
import type { IdGen } from './clock.js';
import { DomainError } from './errors.js';

/** Room business rules: admin authorization, case-insensitive name uniqueness. */
export class RoomService {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly ids: IdGen,
  ) {}

  async list(): Promise<Room[]> {
    return this.rooms.list();
  }

  async create(actorRole: Role, input: RoomCreateInput): Promise<Room> {
    this.assertAdmin(actorRole);
    await this.assertNameAvailable(input.name);
    return this.rooms.create({
      id: this.ids.next(),
      name: input.name,
      capacity: input.capacity,
      floor: input.floor,
      features: input.features,
      active: input.active,
    });
  }

  async update(actorRole: Role, id: string, input: RoomUpdateInput): Promise<Room> {
    this.assertAdmin(actorRole);
    const room = await this.requireRoom(id);
    if (input.name !== undefined && input.name.toLowerCase() !== room.name.toLowerCase()) {
      await this.assertNameAvailable(input.name);
    }
    const updated: Room = {
      ...room,
      name: input.name ?? room.name,
      capacity: input.capacity ?? room.capacity,
      floor: input.floor ?? room.floor,
      features: input.features ?? room.features,
      active: input.active ?? room.active,
    };
    return this.rooms.update(updated);
  }

  /** Soft delete: the room stays in the grid with its history but rejects new bookings. */
  async deactivate(actorRole: Role, id: string): Promise<Room> {
    this.assertAdmin(actorRole);
    const room = await this.requireRoom(id);
    return this.rooms.update({ ...room, active: false });
  }

  /** Authorization lives in the service layer (engineering standards §4). */
  private assertAdmin(actorRole: Role): void {
    if (actorRole !== 'admin') {
      throw new DomainError('FORBIDDEN', 'Admin access required');
    }
  }

  private async requireRoom(id: string): Promise<Room> {
    const room = await this.rooms.findById(id);
    if (!room) throw new DomainError('NOT_FOUND', 'Room not found');
    return room;
  }

  private async assertNameAvailable(name: string): Promise<void> {
    const clash = await this.rooms.findByName(name);
    if (clash) {
      throw new DomainError('ROOM_NAME_TAKEN', 'A room with this name already exists');
    }
  }
}
