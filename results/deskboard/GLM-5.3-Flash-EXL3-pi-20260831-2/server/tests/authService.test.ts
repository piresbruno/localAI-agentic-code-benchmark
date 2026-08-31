import { ERROR_CODES, RegisterInput } from '@deskboard/shared';
import { beforeEach, describe, expect, it } from 'vitest';
import { MemoryUserRepository } from '../src/repositories/memory';
import { AuthService } from '../src/services/authService';
import { IdGen } from '../src/services/ports';
import { PasswordHasher } from '../src/auth/passwords';
import { TokenIssuer } from '../src/auth/jwt';

const ids: IdGen = { next: () => `user-${++seq}` };
let seq = 0;

/** Deterministic fakes — no real crypto in unit tests. */
const hasher: PasswordHasher = {
  hash: async (plain) => `hashed:${plain}`,
  verify: async (plain, stored) => stored === `hashed:${plain}`,
};
const tokens: TokenIssuer = { issue: (payload) => `token:${payload.sub}:${payload.role}` };

const registerInput = (overrides: Partial<RegisterInput> = {}): RegisterInput => ({
  name: 'Dana Employee',
  email: 'dana@deskboard.local',
  password: 'long-enough-password',
  ...overrides,
});

let users: MemoryUserRepository;
let service: AuthService;

beforeEach(() => {
  seq = 0;
  users = new MemoryUserRepository();
  service = new AuthService(users, ids, hasher, tokens);
});

describe('AuthService.register', () => {
  it('creates an employee account and returns a token without leaking the hash', async () => {
    const result = await service.register(registerInput());
    expect(result.user.role).toBe('employee');
    expect(result.token).toBe('token:user-1:employee');
    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a duplicate email with a 409 (case-insensitive)', async () => {
    await service.register(registerInput());
    await expect(
      service.register(registerInput({ email: 'DANA@deskboard.local' })),
    ).rejects.toMatchObject({ code: ERROR_CODES.EMAIL_IN_USE, status: 409 });
  });
});

describe('AuthService.login', () => {
  it('returns a token for valid credentials', async () => {
    await service.register(registerInput());
    const result = await service.login({
      email: 'dana@deskboard.local',
      password: 'long-enough-password',
    });
    expect(result.user.id).toBe('user-1');
    expect(result.token).toContain('user-1');
  });

  it('rejects a wrong password with a 401', async () => {
    await service.register(registerInput());
    await expect(
      service.login({ email: 'dana@deskboard.local', password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.UNAUTHENTICATED, status: 401 });
  });

  it('rejects an unknown email with a 401', async () => {
    await expect(
      service.login({ email: 'nobody@deskboard.local', password: 'whatever-pass' }),
    ).rejects.toMatchObject({ code: ERROR_CODES.UNAUTHENTICATED, status: 401 });
  });
});

describe('AuthService.me', () => {
  it('returns the public profile of the authenticated user', async () => {
    const { user } = await service.register(registerInput());
    const me = await service.me(user.id);
    expect(me.email).toBe('dana@deskboard.local');
    expect(me).not.toHaveProperty('passwordHash');
  });

  it('rejects with a 401 when the account no longer exists', async () => {
    await expect(service.me('ghost')).rejects.toMatchObject({
      code: ERROR_CODES.UNAUTHENTICATED,
      status: 401,
    });
  });
});
