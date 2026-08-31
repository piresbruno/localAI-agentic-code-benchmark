import { ERROR_CODES, RoomInput } from '@deskboard/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryRoomRepository } from '../src/repositories/memory';
import { AppError } from '../src/services/errors';
import { RoomService } from '../src/services/roomService';
import { IdGen } from '../src/services/ports';

const ids: IdGen = { next: () => 'room-new' };

const input = (overrides: Partial<RoomInput> = {}): RoomInput => ({
  name: 'Ontario',
  capacity: 12,
  floor: 5,
  features: ['screen', 'whiteboard'],
  active: true,
  ...overrides,
});

let rooms: MemoryRoomRepository;
let service: RoomService;

beforeEach(async () => {
  rooms = new MemoryRoomRepository();
  service = new RoomService(rooms, ids);
  await rooms.create({
    id: 'room-1',
    name: 'Hudson',
    capacity: 8,
    floor: 3,
    features: ['screen'],
    active: true,
  });
});

describe('RoomService.create', () => {
  it('creates a room with the injected id', async () => {
    const created = await service.create(input());
    expect(created.id).toBe('room-new');
    expect(created.name).toBe('Ontario');
    expect(created.features).toEqual(['screen', 'whiteboard']);
  });

  it('rejects_duplicate_room_name on create (case-insensitive)', async () => {
    await expect(
      service.create(input({ name: 'hudson' })),
    ).rejects.toMatchObject({ code: ERROR_CODES.DUPLICATE_ROOM_NAME, status: 409 } satisfies Partial<AppError>);
  });

  it('rejects_duplicate_room_name on update when another room owns the name', async () => {
    await service.create(input());
    await expect(
      service.update('room-1', input({ name: 'ONTARIO' })),
    ).rejects.toMatchObject({ code: ERROR_CODES.DUPLICATE_ROOM_NAME, status: 409 });
  });

  it('allows a room to keep its own name on update', async () => {
    const updated = await service.update('room-1', input({ name: 'Hudson', capacity: 10 }));
    expect(updated.capacity).toBe(10);
    expect(updated.id).toBe('room-1');
  });
});

describe('RoomService.lifecycle', () => {
  it('deactivates a room without deleting it', async () => {
    const deactivated = await service.deactivate('room-1');
    expect(deactivated.active).toBe(false);
    expect(await rooms.findById('room-1')).toBeDefined();
  });

  it('returns 404 when updating an unknown room', async () => {
    await expect(service.update('missing', input())).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
      status: 404,
    });
  });

  it('returns 404 when deactivating an unknown room', async () => {
    await expect(service.deactivate('missing')).rejects.toMatchObject({
      code: ERROR_CODES.NOT_FOUND,
      status: 404,
    });
  });

  it('lists all rooms including deactivated ones', async () => {
    await service.deactivate('room-1');
    const all = await service.list();
    expect(all).toHaveLength(1);
    expect(all[0].active).toBe(false);
  });
});
