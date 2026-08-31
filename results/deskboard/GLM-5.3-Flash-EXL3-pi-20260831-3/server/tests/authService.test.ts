import { describe, expect, it } from 'vitest';
import { AuthService } from '../src/services/authService.js';
import { DomainError } from '../src/services/errors.js';
import type { IdGen } from '../src/services/clock.js';
import type { StoredUser, UserRepository } from '../src/repositories/userRepository.js';
import { verifyToken } from '../src/auth/tokens.js';

const seqIdGen: IdGen = (() => {
  let n = 0;
  return { next: () => `id-${++n}` };
})();

/** Minimal in-memory stand-in for the real repository (T4). */
class FakeUserRepo implements UserRepository {
  private byId = new Map<string, StoredUser>();
  private byEmail = new Map<string, StoredUser>();

  async findById(id: string) {
    return this.byId.get(id) ?? null;
  }
  async findByEmail(email: string) {
    return this.byEmail.get(email) ?? null;
  }
  async create(user: StoredUser) {
    this.byId.set(user.id, user);
    this.byEmail.set(user.email, user);
    return user;
  }
}

const SECRET = 'test-secret';

function makeService(repo = new FakeUserRepo()) {
  return new AuthService(repo, seqIdGen, SECRET);
}

describe('AuthService', () => {
  it('registers a new employee and never exposes the password hash', async () => {
    const service = makeService();
    const result = await service.register({
      name: 'Ana',
      email: 'ana@office.local',
      password: 'longenough1',
    });
    expect(result.user).toEqual({
      id: 'id-1',
      name: 'Ana',
      email: 'ana@office.local',
      role: 'employee',
    });
    expect(result.token).toBeTruthy();
    expect(verifyToken(result.token, SECRET)?.sub).toBe('id-1');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('rejects duplicate registration case-insensitively with EMAIL_TAKEN', async () => {
    const service = makeService();
    await service.register({ name: 'Ana', email: 'ana@office.local', password: 'longenough1' });
    await expect(
      service.register({ name: 'Ana 2', email: 'ANA@OFFICE.LOCAL', password: 'longenough2' }),
    ).rejects.toMatchObject({ code: 'EMAIL_TAKEN', status: 409 });
  });

  it('logs in with correct credentials and issues a 12h token', async () => {
    const service = makeService();
    await service.register({ name: 'Ana', email: 'ana@office.local', password: 'longenough1' });
    const result = await service.login({ email: 'ana@office.local', password: 'longenough1' });
    expect(result.user.email).toBe('ana@office.local');
    const decoded = JSON.parse(Buffer.from(result.token.split('.')[1], 'base64url').toString());
    expect(decoded.exp - decoded.iat).toBe(12 * 60 * 60);
  });

  it('rejects login with a wrong password as UNAUTHENTICATED', async () => {
    const service = makeService();
    await service.register({ name: 'Ana', email: 'ana@office.local', password: 'longenough1' });
    await expect(
      service.login({ email: 'ana@office.local', password: 'wrong-password' }),
    ).rejects.toMatchObject({ code: 'UNAUTHENTICATED', status: 401 });
  });

  it('rejects login for an unknown email with the same message as a wrong password', async () => {
    const service = makeService();
    await service.register({ name: 'Ana', email: 'ana@office.local', password: 'longenough1' });
    const unknown = service.login({ email: 'nobody@office.local', password: 'whatever123' });
    const wrongPw = service.login({ email: 'ana@office.local', password: 'nope-nope' });
    await expect(unknown).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    await expect(wrongPw).rejects.toMatchObject({ message: 'Invalid email or password' });
  });

  it('returns the current user profile for a valid id', async () => {
    const service = makeService();
    const { user } = await service.register({
      name: 'Ana',
      email: 'ana@office.local',
      password: 'longenough1',
    });
    await expect(service.me(user.id)).resolves.toEqual(user);
  });

  it('throws NOT_FOUND when the profile id is unknown', async () => {
    const service = makeService();
    await expect(service.me('missing')).rejects.toMatchObject({ code: 'NOT_FOUND', status: 404 });
  });

  it('exposes DomainError as an Error subclass with a status', () => {
    const err = new DomainError('FORBIDDEN', 'nope');
    expect(err).toBeInstanceOf(Error);
    expect(err.status).toBe(403);
    expect(err.code).toBe('FORBIDDEN');
  });
});
