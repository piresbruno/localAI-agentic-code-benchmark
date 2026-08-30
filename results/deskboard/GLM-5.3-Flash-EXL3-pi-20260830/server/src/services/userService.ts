/**
 * User service — registration, login and password change.
 * Authorization-relevant state (roles) is owned here; the HTTP layer only
 * forwards the authenticated actor.
 */
import { AppError, unauthenticated, type LoginInput, type PublicUser, type RegisterInput } from 'deskboard-shared';
import type { StoredUser, UserRepository } from '../repositories/types.js';
import type { Clock, IdGen } from './clock.js';
import { hashPassword, verifyPassword } from '../auth/password.js';

export class UserService {
  readonly #users: UserRepository;
  readonly #clock: Clock;
  readonly #ids: IdGen;

  constructor(deps: { users: UserRepository; clock: Clock; ids: IdGen }) {
    this.#users = deps.users;
    this.#clock = deps.clock;
    this.#ids = deps.ids;
  }

  /** Anyone may register; they always become `employee`. */
  register(input: RegisterInput): StoredUser {
    const existing = this.#users.findByEmail(input.email);
    if (existing) {
      throw new AppError('EMAIL_IN_USE', 'An account with that email already exists');
    }
    return this.#users.create({
      id: this.#ids.next(),
      name: input.name,
      email: input.email,
      role: 'employee',
      passwordHash: hashPassword(input.password),
      createdAt: this.#clock.now().toISOString()
    });
  }

  /** Verifies credentials; failure is always reported as 401. */
  login(input: LoginInput): StoredUser {
    const user = this.#users.findByEmail(input.email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw unauthenticated('Invalid email or password');
    }
    return user;
  }

  /** Changes the caller's password after verifying the current one. */
  changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): StoredUser {
    const user = this.#users.findById(userId);
    if (!user) throw unauthenticated();
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new AppError('FORBIDDEN', 'Current password is incorrect');
    }
    const updated = this.#users.updatePasswordHash(userId, hashPassword(newPassword));
    return updated!;
  }

  toPublic(user: StoredUser): PublicUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }
}
