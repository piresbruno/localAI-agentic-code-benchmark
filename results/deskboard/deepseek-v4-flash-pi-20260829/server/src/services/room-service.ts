/**
 * RoomService — admin-only room management, case-insensitive name uniqueness,
 * soft deactivation that blocks new bookings (enforced by BookingService).
 */
import type { Feature, Room, RoomCreateInput, RoomUpdateInput } from 'shared';
import { DomainError } from 'shared';
import type { Clock, IdGen } from '../ports.js';
import type { RoomRepository } from '../repositories/room-repository.js';
import type { Caller } from './booking-service.js';

export interface RoomServiceDeps {
  rooms: RoomRepository;
  clock: Clock;
  idGen: IdGen;
}

export class RoomService {
  constructor(private readonly deps: RoomServiceDeps) {}

  private assertAdmin(caller: Caller): void {
    if (caller.role !== 'admin') {
      throw new DomainError('FORBIDDEN', 'Admin role required to manage rooms');
    }
  }

  private async assertNameFree(name: string, excludeId?: string): Promise<void> {
    const existing = await this.deps.rooms.findByDisplayName(name);
    if (existing && existing.id !== excludeId) {
      throw new DomainError('ROOM_NAME_TAKEN', 'A room with this name already exists', {
        name,
      });
    }
  }

  async create(input: RoomCreateInput, caller: Caller): Promise<Room> {
    this.assertAdmin(caller);
    await this.assertNameFree(input.name);
    const room: Room = {
      id: this.deps.idGen.next(),
      name: input.name.trim(),
      capacity: input.capacity,
      floor: input.floor,
      features: [...input.features] as Feature[],
      active: true,
    };
    await this.deps.rooms.create(room);
    return room;
  }

  async update(id: string, patch: RoomUpdateInput, caller: Caller): Promise<Room> {
    this.assertAdmin(caller);
    const room = await this.deps.rooms.findById(id);
    if (!room) throw new DomainError('NOT_FOUND', 'Room not found');

    const next: Room = { ...room };
    if (patch.name !== undefined) {
      await this.assertNameFree(patch.name, id);
      next.name = patch.name.trim();
    }
    if (patch.capacity !== undefined) next.capacity = patch.capacity;
    if (patch.floor !== undefined) next.floor = patch.floor;
    if (patch.features !== undefined) next.features = [...patch.features];

    await this.deps.rooms.update(next);
    return next;
  }

  /** Soft deactivate: blocks new bookings; existing bookings are untouched. */
  async deactivate(id: string, caller: Caller): Promise<Room> {
    this.assertAdmin(caller);
    const room = await this.deps.rooms.findById(id);
    if (!room) throw new DomainError('NOT_FOUND', 'Room not found');
    const updated: Room = { ...room, active: false };
    await this.deps.rooms.update(updated);
    return updated;
  }

  async list(): Promise<Room[]> {
    const rooms = await this.deps.rooms.listAll();
    return rooms.sort((a, b) => a.floor - b.floor || a.name.localeCompare(b.name));
  }
}
