import { describe, expect, it } from 'vitest';
import { DomainError } from 'shared';
import type { Clock, IdGen } from '../ports.js';
import { InMemoryUserRepository } from '../repositories/user-repository.js';
import { UserService } from './user-service.js';
import { verifyPassword } from '../auth/password.js';

const fixedNow = new Date('2026-08-29T10:00:00Z');
const clock: Clock = { now: () => fixedNow };
let nextId = 1;
const idGen: IdGen = { next: () => `u-${nextId++}` };

function makeService() {
  return new UserService({ users: new InMemoryUserRepository(), clock, idGen });
}

const base = { name: 'Grace Hopper', email: 'grace@example.com', password: 'supersecret' };

describe('UserService.register', () => {
  it('creates an employee user with a hashed password', async () => {
    const svc = makeService();
    const user = await svc.register(base);
    expect(user).toMatchObject({ role: 'employee', email: 'grace@example.com' });
    const all = await svc['deps'].users.findByEmail('grace@example.com');
    expect(all?.passwordHash).not.toContain('supersecret');
    expect(verifyPassword('supersecret', all!.passwordHash)).toBe(true);
  });

  it('normalizes email to lowercase', async () => {
    const svc = makeService();
    const user = await svc.register({ ...base, email: 'Grace@Example.COM' });
    expect(user.email).toBe('grace@example.com');
  });

  it('rejects a duplicate email case-insensitively', async () => {
    const svc = makeService();
    await svc.register(base);
    await expect(svc.register({ ...base, email: 'GRACE@example.com' })).rejects.toMatchObject({
      code: 'EMAIL_TAKEN',
    });
  });
});

describe('UserService.login', () => {
  it('returns the user for valid credentials', async () => {
    const svc = makeService();
    await svc.register(base);
    await expect(svc.login('grace@example.com', 'supersecret')).resolves.toMatchObject({
      email: 'grace@example.com',
    });
  });

  it('rejects a wrong password with INVALID_CREDENTIALS', async () => {
    const svc = makeService();
    await svc.register(base);
    await expect(svc.login('grace@example.com', 'wrongpass')).rejects.toBeInstanceOf(DomainError);
    await expect(svc.login('grace@example.com', 'wrongpass')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });

  it('rejects an unknown email with the same error (no user enumeration)', async () => {
    const svc = makeService();
    await expect(svc.login('nobody@example.com', 'whatever8')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});

describe('UserService.getById', () => {
  it('returns the public user', async () => {
    const svc = makeService();
    const user = await svc.register(base);
    await expect(svc.getById(user.id)).resolves.toEqual(user);
  });

  it('throws NOT_FOUND for unknown ids', async () => {
    await expect(makeService().getById('missing')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });
});

describe('UserService.changePassword', () => {
  it('updates the password hash; old password stops working', async () => {
    const svc = makeService();
    const user = await svc.register(base);
    await svc.changePassword(user.id, 'supersecret', 'newpass123');
    await expect(svc.login('grace@example.com', 'supersecret')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    await expect(svc.login('grace@example.com', 'newpass123')).resolves.toMatchObject({
      id: user.id,
    });
  });

  it('rejects a wrong current password', async () => {
    const svc = makeService();
    const user = await svc.register(base);
    await expect(svc.changePassword(user.id, 'wrong-current', 'newpass123')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
  });
});
