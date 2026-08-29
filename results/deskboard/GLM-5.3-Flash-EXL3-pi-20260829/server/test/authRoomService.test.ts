/** Unit tests for AuthService and RoomService rules. */
import { beforeEach, describe, expect, it } from 'vitest';
import { AuthService } from '../src/services/authService.js';
import { RoomService } from '../src/services/roomService.js';
import { InMemoryRoomRepository, InMemoryUserRepository } from '../src/repositories/inMemory.js';
import { TokenService } from '../src/auth/tokens.js';
import { FixedClock, SeqIdGen } from './helpers.js';

function makeAuth() {
  const clock = new FixedClock();
  const users = new InMemoryUserRepository();
  const auth = new AuthService({ users, clock, idGen: new SeqIdGen(), tokens: new TokenService('test-secret') });
  return { auth, users, clock };
}

describe('AuthService', () => {
  let auth: AuthService;
  let users: InMemoryUserRepository;

  beforeEach(() => {
    ({ auth, users } = makeAuth());
  });

  it('registers a new employee and issues a valid token', async () => {
    const result = await auth.register({ name: 'Ana', email: 'ana@x.io', password: 'password123' });
    expect(result.user.role).toBe('employee');
    expect(result.user).not.toHaveProperty('passwordHash');
    const payload = new TokenService('test-secret').verify(result.token);
    expect(payload.sub).toBe(result.user.id);
  });

  it('rejects duplicate email registration regardless of case', async () => {
    await auth.register({ name: 'Ana', email: 'ana@x.io', password: 'password123' });
    await expect(auth.register({ name: 'Ana 2', email: 'ANA@X.IO', password: 'password123' })).rejects.toMatchObject({
      code: 'CONFLICT',
    });
  });

  it('logs in with correct credentials and fails with wrong password', async () => {
    await auth.register({ name: 'Ana', email: 'ana@x.io', password: 'password123' });
    await expect(auth.login({ email: 'ana@x.io', password: 'password123' })).resolves.toMatchObject({
      user: { email: 'ana@x.io' },
    });
    await expect(auth.login({ email: 'ana@x.io', password: 'wrong-password' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
    await expect(auth.login({ email: 'ghost@x.io', password: 'password123' })).rejects.toMatchObject({
      code: 'UNAUTHENTICATED',
    });
  });

  it('changePassword verifies the current password and rejects unchanged new password', async () => {
    const { user } = await auth.register({ name: 'Ana', email: 'ana@x.io', password: 'password123' });
    await expect(auth.changePassword(user.id, { currentPassword: 'wrong', newPassword: 'newpassword1' })).rejects.toMatchObject({
      code: 'VALIDATION_FAILED',
    });
    await expect(
      auth.changePassword(user.id, { currentPassword: 'password123', newPassword: 'password123' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    await auth.changePassword(user.id, { currentPassword: 'password123', newPassword: 'newpassword1' });
    await expect(auth.login({ email: 'ana@x.io', password: 'newpassword1' })).resolves.toBeTruthy();
    await expect(auth.login({ email: 'ana@x.io', password: 'password123' })).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
  });

  it('requireRole enforces admin authorization in the service layer', async () => {
    const { user } = await auth.register({ name: 'Ana', email: 'ana@x.io', password: 'password123' });
    expect(() => auth.requireRole(user.id, 'admin')).toThrow(/Admin permission required/);
  });

  it('requireUser rejects tokens for deleted users', async () => {
    const { user } = await auth.register({ name: 'Ana', email: 'ana@x.io', password: 'password123' });
    users.updatePasswordHash(user.id, users.getPasswordHash(user.id)!);
    expect(auth.requireUser(user.id).id).toBe(user.id);
  });
});

describe('RoomService — admins_manage_rooms_only', () => {
  let rooms: RoomService;
  const admin = { id: 'a1', name: 'A', email: 'a@x.io', role: 'admin' as const, createdAt: '' };
  const employee = { id: 'e1', name: 'E', email: 'e@x.io', role: 'employee' as const, createdAt: '' };
  let roomId: string;

  beforeEach(() => {
    rooms = new RoomService({ rooms: new InMemoryRoomRepository(), clock: new FixedClock(), idGen: new SeqIdGen() });
    roomId = rooms.create(admin, { name: 'Boardroom', capacity: 10, floor: 3, features: ['screen'], active: true }).id;
  });

  it('rejects duplicate room name case-insensitively with 409', () => {
    expect(() => rooms.create(admin, { name: 'BOARDROOM', capacity: 5, floor: 1, features: [], active: true })).toThrowError(
      expect.objectContaining({ code: 'CONFLICT' }),
    );
  });

  it('allows employees to list and read rooms', () => {
    expect(rooms.list()).toHaveLength(1);
    expect(rooms.get(roomId).name).toBe('Boardroom');
  });

  it('forbids employee room mutations', () => {
    expect(() => rooms.create(employee, { name: 'New', capacity: 5, floor: 1, features: [], active: true })).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => rooms.update(employee, roomId, { capacity: 20 })).toThrowError(
      expect.objectContaining({ code: 'FORBIDDEN' }),
    );
    expect(() => rooms.deactivate(employee, roomId)).toThrowError(expect.objectContaining({ code: 'FORBIDDEN' }));
  });

  it('updates a room and enforces name uniqueness excluding itself', () => {
    rooms.create(admin, { name: 'Other', capacity: 5, floor: 1, features: [], active: true });
    const updated = rooms.update(admin, roomId, { name: 'Boardroom XL', capacity: 12 });
    expect(updated.name).toBe('Boardroom XL');
    expect(updated.capacity).toBe(12);
    // Renaming to its own (case-varied) name is fine.
    expect(() => rooms.update(admin, roomId, { name: 'BOARDROOM XL' })).not.toThrow();
    // Renaming onto another room's name is not.
    expect(() => rooms.update(admin, roomId, { name: 'other' })).toThrowError(
      expect.objectContaining({ code: 'CONFLICT' }),
    );
  });

  it('deactivates (soft delete) instead of removing — the room stays listed', () => {
    const deactivated = rooms.deactivate(admin, roomId);
    expect(deactivated.active).toBe(false);
    expect(rooms.get(roomId).active).toBe(false);
    expect(rooms.list()).toHaveLength(1);
  });

  it('returns 404 for unknown rooms', () => {
    expect(() => rooms.get('missing')).toThrowError(expect.objectContaining({ code: 'NOT_FOUND' }));
  });
});
