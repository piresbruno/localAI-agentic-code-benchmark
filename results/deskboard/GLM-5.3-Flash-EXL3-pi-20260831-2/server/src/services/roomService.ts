import { ERROR_CODES, Room, RoomInput } from '@deskboard/shared';
import { RoomRepository } from '../repositories/types';
import { AppError } from './errors';
import { IdGen } from './ports';

/** Room management: uniqueness, updates and soft deactivation. */
export class RoomService {
  constructor(
    private readonly rooms: RoomRepository,
    private readonly ids: IdGen,
  ) {}

  list(): Promise<Room[]> {
    return this.rooms.list();
  }

  async getById(id: string): Promise<Room> {
    const room = await this.rooms.findById(id);
    if (!room) throw new AppError(ERROR_CODES.NOT_FOUND, 'Room not found');
    return room;
  }

  async create(input: RoomInput): Promise<Room> {
    await this.assertNameFree(input.name);
    return this.rooms.create({ id: this.ids.next(), ...input });
  }

  async update(id: string, input: RoomInput): Promise<Room> {
    const existing = await this.getById(id);
    await this.assertNameFree(input.name, id);
    return this.rooms.update({ ...existing, ...input, id: existing.id });
  }

  /** Soft delete: the room stays in the store but stops accepting new bookings. */
  async deactivate(id: string): Promise<Room> {
    const existing = await this.getById(id);
    return this.rooms.update({ ...existing, active: false });
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const clash = await this.rooms.findByNameIgnoreCase(name);
    if (clash && clash.id !== excludeId) {
      throw new AppError(
        ERROR_CODES.DUPLICATE_ROOM_NAME,
        `A room named "${name}" already exists (names are case-insensitive)`,
      );
    }
  }
}
