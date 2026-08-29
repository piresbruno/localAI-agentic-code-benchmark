import jwt from 'jsonwebtoken';
import { describe, expect, it } from 'vitest';
import { issueToken, verifyToken } from './token.js';

const SECRET = 'test-secret';

describe('issueToken / verifyToken', () => {
  it('round-trips subject and role', () => {
    const token = issueToken(SECRET, 'user-1', 'admin');
    expect(verifyToken(SECRET, token)).toEqual({ sub: 'user-1', role: 'admin' });
  });

  it('rejects a token signed with a different secret', () => {
    const token = issueToken('other-secret', 'user-1', 'employee');
    expect(() => verifyToken(SECRET, token)).toThrow();
  });

  it('rejects a tampered token', () => {
    const token = issueToken(SECRET, 'user-1', 'employee');
    expect(() => verifyToken(SECRET, `${token.slice(0, -4)}xxxx`)).toThrow();
  });

  it('rejects garbage strings', () => {
    expect(() => verifyToken(SECRET, 'not-a-jwt')).toThrow();
  });

  it('rejects an expired token', () => {
    const expired = jwt.sign({ role: 'employee' }, SECRET, {
      issuer: 'deskboard',
      subject: 'user-1',
      expiresIn: '-1s',
    });
    expect(() => verifyToken(SECRET, expired)).toThrow();
  });

  it('rejects a token with an invalid role claim', () => {
    const bad = jwt.sign({ role: 'superuser' }, SECRET, {
      issuer: 'deskboard',
      subject: 'user-1',
      expiresIn: '1h',
    });
    expect(() => verifyToken(SECRET, bad)).toThrow('invalid token role');
  });
});
