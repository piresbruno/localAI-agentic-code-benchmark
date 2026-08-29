/** Authentication business rules: registration, login, password change. */
import type { PublicUser, User } from '@deskboard/shared';
import { DomainError, forbiddenError, notFoundError, unauthenticatedError, validationError } from '@deskboard/shared';
import type { UserRepository } from '../repositories/types.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import type { Clock, IdGen } from './clock.js';
import type { TokenService } from '../auth/tokens.js';

export interface AuthServiceDeps {
  users: UserRepository;
  clock: Clock;
  idGen: IdGen;
  tokens: TokenService;
}

export class AuthService {
  private readonly users: UserRepository;
  private readonly clock: Clock;
  private readonly idGen: IdGen;
  private readonly tokens: TokenService;

  constructor(deps: AuthServiceDeps) {
    this.users = deps.users;
    this.clock = deps.clock;
    this.idGen = deps.idGen;
    this.tokens = deps.tokens;
  }

  /** Registers a new employee. Admin accounts only exist via seeding. */
  register(input: { name: string; email: string; password: string }): { token: string; user: PublicUser } {
    if (this.users.findByEmail(input.email)) {
      throw new DomainError('CONFLICT', 'An account with this email already exists');
    }
    const user: User = {
      id: this.idGen.next(),
      name: input.name,
      email: input.email,
      role: 'employee',
      createdAt: this.clock.now().toISOString(),
    };
    this.users.create(user, hashPassword(input.password));
    return { token: this.tokens.issue(user), user: toPublic(user) };
  }

  /** Verifies credentials and returns a fresh JWT. */
  login(input: { email: string; password: string }): { token: string; user: PublicUser } {
    const user = this.users.findByEmail(input.email);
    const stored = user ? this.users.getPasswordHash(user.id) : undefined;
    if (!user || !stored || !verifyPassword(input.password, stored)) {
      throw unauthenticatedError('Invalid email or password');
    }
    return { token: this.tokens.issue(user), user: toPublic(user) };
  }

  /** Returns the authenticated user's public profile. */
  me(userId: string): PublicUser {
    const user = this.users.findById(userId);
    if (!user) throw notFoundError('User not found');
    return toPublic(user);
  }

  /** Changes the caller's password after verifying the current one. */
  changePassword(
    userId: string,
    input: { currentPassword: string; newPassword: string },
  ): void {
    const user = this.users.findById(userId);
    if (!user) throw notFoundError('User not found');
    const stored = this.users.getPasswordHash(userId);
    if (!stored || !verifyPassword(input.currentPassword, stored)) {
      throw validationError('Current password is incorrect');
    }
    if (input.currentPassword === input.newPassword) {
      throw validationError('New password must be different from the current password');
    }
    this.users.updatePasswordHash(userId, hashPassword(input.newPassword));
  }

  /** Resolves a JWT payload's user id to a live user (re-checks existence). */
  requireUser(userId: string): PublicUser {
    const user = this.users.findById(userId);
    if (!user) throw unauthenticatedError('Account no longer exists');
    return toPublic(user);
  }

  /** Role check helper used by other services for authorization decisions. */
  requireRole(userId: string, role: 'admin'): void {
    const user = this.users.findById(userId);
    if (!user || user.role !== role) {
      throw forbiddenError('Admin permission required');
    }
  }
}

export function toPublic(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role, createdAt: user.createdAt };
}
