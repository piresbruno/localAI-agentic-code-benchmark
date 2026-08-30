// @vitest-environment node
import { describe, it, expect, beforeEach } from 'vitest';
import { InMemoryUserRepository, type UserRepository } from '../repositories/index.js';
import { fixedClock, sequentialIdGen } from './clock.js';
import { UserService } from './userService.js';
import { AppError } from 'deskboard-shared';

const NOW = '2026-09-07T09:00';

interface Ctx {
  users: UserRepository;
  service: UserService;
}

const setup = (): Ctx => {
  const users = new InMemoryUserRepository();
  const service = new UserService({ users, clock: fixedClock(NOW), ids: sequentialIdGen('u') });
  return { users, service };
};

describe('user service', () => {
  let ctx: Ctx;
  beforeEach(() => {
    ctx = setup();
  });

  it('registers employees with hashed passwords and normalizes email', () => {
    const { service, users } = ctx;
    const user = service.register({
      name: 'Nina New',
      email: 'Nina@Example.com',
      password: 'password123'
    });
    expect(user.role).toBe('employee');
    expect(user.email).toBe('nina@example.com');
    expect(user.passwordHash).not.toContain('password123');
    expect(users.findByEmail('nina@example.com')).not.toBeNull();
  });

  it('rejects duplicate registration emails (case-insensitive)', () => {
    const { service } = ctx;
    service.register({ name: 'Nina', email: 'nina@example.com', password: 'password123' });
    try {
      service.register({ name: 'Nina 2', email: 'NINA@example.com', password: 'password123' });
      expect.unreachable();
    } catch (err) {
      const e = err as AppError;
      expect(e.code).toBe('EMAIL_IN_USE');
      expect(e.httpStatus).toBe(409);
    }
  });

  it('logs in with valid credentials and rejects bad ones with 401', () => {
    const { service } = ctx;
    service.register({ name: 'Nina', email: 'nina@example.com', password: 'password123' });
    expect(service.login({ email: 'nina@example.com', password: 'password123' }).name).toBe('Nina');
    expect(() => service.login({ email: 'nina@example.com', password: 'wrong-pass-1' })).toThrowError(
      /Invalid email or password/
    );
    expect(() => service.login({ email: 'ghost@example.com', password: 'password123' })).toThrowError(
      /Invalid email or password/
    );
  });

  it('changes password with correct current password and rejects wrong one', () => {
    const { service } = ctx;
    const user = service.register({
      name: 'Nina',
      email: 'nina@example.com',
      password: 'password123'
    });
    expect(() =>
      service.changePassword(user.id, 'wrong-current', 'newpassword1')
    ).toThrowError(/Current password is incorrect/);
    service.changePassword(user.id, 'password123', 'newpassword1');
    // Old password no longer works, new one does
    expect(() => service.login({ email: 'nina@example.com', password: 'password123' })).toThrow();
    expect(service.login({ email: 'nina@example.com', password: 'newpassword1' }).id).toBe(user.id);
  });

  it('toPublic strips password material', () => {
    const { service } = ctx;
    const user = service.register({ name: 'Nina', email: 'nina@example.com', password: 'password123' });
    const pub = service.toPublic(user);
    expect(Object.keys(pub).sort()).toEqual(['email', 'id', 'name', 'role']);
  });
});
