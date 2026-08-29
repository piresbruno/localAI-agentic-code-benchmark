import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('hashPassword / verifyPassword', () => {
  it('verifies a correct password after hashing', () => {
    const hash = hashPassword('correct horse battery');
    expect(hash).not.toContain('correct horse battery');
    expect(verifyPassword('correct horse battery', hash)).toBe(true);
  });

  it('rejects a wrong password', () => {
    const hash = hashPassword('right-password');
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('produces a unique salt per hash', () => {
    expect(hashPassword('same-pass')).not.toBe(hashPassword('same-pass'));
  });

  it('rejects malformed stored hashes', () => {
    expect(verifyPassword('x', 'not-a-hash')).toBe(false);
    expect(verifyPassword('x', '')).toBe(false);
  });
});
