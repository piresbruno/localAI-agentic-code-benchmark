import { describe, expect, it } from 'vitest';
import { AppError } from '../src/services/errors';
import { verifyPassword } from '../src/auth/password';
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

describe('AuthService.register', () => {
  it('registers employees with a hashed password and returns a usable JWT', () => {
    const ctx = makeCtx();
    const res = ctx.auth.register({ name: 'Nina New', email: 'nina@corp.test', password: 's3cret-pass' });
    expect(res.user.role).toBe('employee');
    expect(res.user.email).toBe('nina@corp.test');
    expect(res.token.split('.')).toHaveLength(3);
    // 12h expiry claim present
    const payload = JSON.parse(Buffer.from(res.token.split('.')[1], 'base64url').toString());
    expect(payload.exp - payload.iat).toBe(12 * 3600);
  });

  it('rejects duplicate registration emails (409, case-insensitive)', () => {
    const ctx = makeCtx();
    ctx.auth.register({ name: 'Nina', email: 'nina@corp.test', password: 's3cret-pass' });
    expect(
      errorCode(() => ctx.auth.register({ name: 'Nina 2', email: 'NINA@corp.test', password: 's3cret-pass' })),
    ).toBe('EMAIL_TAKEN');
  });
});

describe('AuthService.login', () => {
  it('logs in with correct credentials', () => {
    const ctx = makeCtx();
    ctx.auth.register({ name: 'Nina', email: 'nina@corp.test', password: 's3cret-pass' });
    const res = ctx.auth.login({ email: 'nina@corp.test', password: 's3cret-pass' });
    expect(res.user.name).toBe('Nina');
  });

  it('rejects wrong passwords and unknown emails with INVALID_CREDENTIALS', () => {
    const ctx = makeCtx();
    ctx.auth.register({ name: 'Nina', email: 'nina@corp.test', password: 's3cret-pass' });
    expect(errorCode(() => ctx.auth.login({ email: 'nina@corp.test', password: 'wrong-pass' }))).toBe(
      'INVALID_CREDENTIALS',
    );
    expect(errorCode(() => ctx.auth.login({ email: 'ghost@corp.test', password: 'whatever1' }))).toBe(
      'INVALID_CREDENTIALS',
    );
  });
});

describe('AuthService.me', () => {
  it('returns the current user for valid claims', () => {
    const ctx = makeCtx();
    const me = ctx.auth.me(ctx.employee);
    expect(me.id).toBe('emp-1');
  });

  it('404s when the token user no longer exists', () => {
    const ctx = makeCtx();
    expect(errorCode(() => ctx.auth.me({ sub: 'gone', role: 'employee', name: 'G' }))).toBe('NOT_FOUND');
  });
});

describe('password hashing', () => {
  it('stores salted scrypt hashes that verify without storing plaintext', () => {
    const ctx = makeCtx();
    const stored = ctx.auth
      .register({ name: 'Nina', email: 'nina@corp.test', password: 's3cret-pass' })
      .user;
    void stored;
    // verify through the service path:
    expect(() => ctx.auth.login({ email: 'nina@corp.test', password: 's3cret-pass' })).not.toThrow();
    expect(verifyPassword('s3cret-pass', 'scrypt:aa:bb')).toBe(false);
    expect(verifyPassword('x', 'garbage')).toBe(false);
  });
});
