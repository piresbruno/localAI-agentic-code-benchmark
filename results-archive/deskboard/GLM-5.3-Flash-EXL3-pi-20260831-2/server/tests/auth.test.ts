import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/passwords';
import { issueToken, verifyToken } from '../src/auth/jwt';

describe('password hashing', () => {
  it('round-trips a password through hash and verify', async () => {
    const stored = await hashPassword('s3cret-password');
    expect(stored.startsWith('scrypt:')).toBe(true);
    await expect(verifyPassword('s3cret-password', stored)).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const stored = await hashPassword('correct-password');
    await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
  });

  it('produces a different hash each time (random salt)', async () => {
    const a = await hashPassword('same-password');
    const b = await hashPassword('same-password');
    expect(a).not.toBe(b);
  });

  it('returns false for a malformed stored hash', async () => {
    await expect(verifyPassword('x', 'not-a-valid-hash')).resolves.toBe(false);
  });
});

describe('jwt issue/verify', () => {
  const SECRET = 'test-secret';

  it('round-trips sub and role', () => {
    const token = issueToken({ sub: 'user-1', role: 'employee' }, SECRET);
    expect(verifyToken(token, SECRET)).toEqual({ sub: 'user-1', role: 'employee' });
  });

  it('returns null for a token signed with a different secret', () => {
    const token = issueToken({ sub: 'user-1', role: 'admin' }, 'other-secret');
    expect(verifyToken(token, SECRET)).toBeNull();
  });

  it('returns null for garbage tokens', () => {
    expect(verifyToken('not-a-jwt', SECRET)).toBeNull();
  });

  it('rejects a payload with an unknown role', () => {
    const token = issueToken({ sub: 'user-1', role: 'admin' }, SECRET);
    const [, payload] = token.split('.');
    const forged = [
      token.split('.')[0],
      Buffer.from(JSON.stringify({ sub: 'user-1', role: 'superadmin' })).toString('base64url'),
      payload,
    ].join('.');
    expect(verifyToken(forged, SECRET)).toBeNull();
  });
});
