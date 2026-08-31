import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../src/auth/passwords.js';
import { issueToken, verifyToken, TOKEN_TTL_SECONDS } from '../src/auth/tokens.js';

describe('passwords', () => {
  it('hashes and verifies a password round-trip', () => {
    const stored = hashPassword('correct horse battery');
    expect(stored).toMatch(/^scrypt:[0-9a-f]+:[0-9a-f]+$/);
    expect(verifyPassword('correct horse battery', stored)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const stored = hashPassword('correct horse battery');
    expect(verifyPassword('wrong password', stored)).toBe(false);
  });

  it('rejects a malformed stored hash instead of throwing', () => {
    expect(verifyPassword('anything', 'not-a-valid-hash')).toBe(false);
    expect(verifyPassword('anything', '')).toBe(false);
  });
});

describe('tokens', () => {
  const payload = { sub: 'u1', name: 'Ana', email: 'ana@x.local', role: 'employee' as const };
  const secret = 'test-secret';

  it('issues a token that verifies back to its payload', () => {
    const token = issueToken(payload, secret);
    expect(verifyToken(token, secret)).toEqual(expect.objectContaining(payload));
  });

  it('sets a 12h expiry claim', () => {
    const token = issueToken(payload, secret);
    const decoded = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    expect(decoded.exp - decoded.iat).toBe(TOKEN_TTL_SECONDS);
  });

  it('returns null for a token signed with another secret', () => {
    const token = issueToken(payload, 'other-secret');
    expect(verifyToken(token, secret)).toBeNull();
  });

  it('returns null for garbage tokens', () => {
    expect(verifyToken('garbage', secret)).toBeNull();
    expect(verifyToken('', secret)).toBeNull();
  });
});
