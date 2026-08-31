import { describe, expect, it } from 'vitest';
import { AppError } from '../src/services/errors';
import { makeCtx } from './helpers';

function errorCode(fn: () => unknown): string {
  try {
    fn();
    throw new Error('expected an AppError to be thrown');
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return (err as AppError).code;
  }
}

describe('RoomService.create — rejects_duplicate_room_name', () => {
  it('rejects a case-insensitive duplicate name with 409', () => {
    const ctx = makeCtx();
    expect(errorCode(() => ctx.roomSvc.create(ctx.admin, { name: 'fjord', capacity: 4, floor: 2, features: [] }))).toBe(
      'ROOM_NAME_TAKEN',
    );
    expect(errorCode(() => ctx.roomSvc.create(ctx.admin, { name: ' FJORD ', capacity: 4, floor: 2, features: [] }))).toBe(
      'ROOM_NAME_TAKEN',
    );
  });

  it('creates a room for admins with defaults applied', () => {
    const ctx = makeCtx();
    const room = ctx.roomSvc.create(ctx.admin, { name: 'Boardroom', capacity: 10, floor: 5, features: ['screen'] });
    expect(room.active).toBe(true);
    expect(room.features).toEqual(['screen']);
  });

  it('forbids employees from creating rooms (403)', () => {
    const ctx = makeCtx();
    expect(errorCode(() => ctx.roomSvc.create(ctx.employee, { name: 'X', capacity: 4, floor: 2, features: [] }))).toBe(
      'FORBIDDEN',
    );
  });
});

describe('RoomService.update', () => {
  it('updates room fields', () => {
    const ctx = makeCtx();
    const room = ctx.roomSvc.update(ctx.admin, ctx.roomId, { capacity: 12, features: ['whiteboard'] });
    expect(room.capacity).toBe(12);
    expect(room.features).toEqual(['whiteboard']);
  });

  it('rejects renaming to an existing room’s name, but allows keeping own name', () => {
    const ctx = makeCtx();
    expect(errorCode(() => ctx.roomSvc.update(ctx.admin, ctx.smallRoomId, { name: 'Fjord' }))).toBe(
      'ROOM_NAME_TAKEN',
    );
    const room = ctx.roomSvc.update(ctx.admin, ctx.roomId, { name: 'FJORD' });
    expect(room.name).toBe('FJORD');
  });

  it('404s for unknown rooms and 403s for employees', () => {
    const ctx = makeCtx();
    expect(errorCode(() => ctx.roomSvc.update(ctx.admin, 'nope', { capacity: 5 }))).toBe('NOT_FOUND');
    expect(errorCode(() => ctx.roomSvc.update(ctx.employee, ctx.roomId, { capacity: 5 }))).toBe(
      'FORBIDDEN',
    );
  });
});

describe('RoomService.deactivate', () => {
  it('soft-deactivates so the room stays listed but inactive', () => {
    const ctx = makeCtx();
    const room = ctx.roomSvc.deactivate(ctx.admin, ctx.roomId);
    expect(room.active).toBe(false);
    expect(ctx.roomSvc.list().find((r) => r.id === ctx.roomId)?.active).toBe(false);
  });

  it('can reactivate via update', () => {
    const ctx = makeCtx();
    ctx.roomSvc.deactivate(ctx.admin, ctx.roomId);
    const room = ctx.roomSvc.update(ctx.admin, ctx.roomId, { active: true });
    expect(room.active).toBe(true);
  });
});
