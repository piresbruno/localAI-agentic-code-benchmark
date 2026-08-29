import type { PublicUser, RegisterInput, User } from 'shared';
import { DomainError } from 'shared';
import { hashPassword, verifyPassword } from '../auth/password.js';
import type { Clock, IdGen } from '../ports.js';
import type { UserRepository } from '../repositories/user-repository.js';

export interface UserServiceDeps {
  users: UserRepository;
  clock: Clock;
  idGen: IdGen;
}

function toPublic(user: User): PublicUser {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}

/**
 * Account lifecycle: registration, authentication, password changes.
 * Emails are normalized to lowercase; all lookups are case-insensitive.
 */
export class UserService {
  constructor(private readonly deps: UserServiceDeps) {}

  async register(input: RegisterInput): Promise<PublicUser> {
    const email = input.email.trim().toLowerCase();
    const existing = await this.deps.users.findByEmail(email);
    if (existing) {
      throw new DomainError('EMAIL_TAKEN', 'An account with this email already exists');
    }
    const user: User = {
      id: this.deps.idGen.next(),
      name: input.name.trim(),
      email,
      passwordHash: hashPassword(input.password),
      role: 'employee',
      createdAt: this.deps.clock.now().toISOString(),
    };
    await this.deps.users.create(user);
    return toPublic(user);
  }

  async login(email: string, password: string): Promise<PublicUser> {
    const user = await this.deps.users.findByEmail(email.trim().toLowerCase());
    if (!user || !verifyPassword(password, user.passwordHash)) {
      throw new DomainError('INVALID_CREDENTIALS', 'Invalid email or password');
    }
    return toPublic(user);
  }

  async getById(id: string): Promise<PublicUser> {
    const user = await this.deps.users.findById(id);
    if (!user) throw new DomainError('NOT_FOUND', 'User not found');
    return toPublic(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await this.deps.users.findById(userId);
    if (!user) throw new DomainError('NOT_FOUND', 'User not found');
    if (!verifyPassword(currentPassword, user.passwordHash)) {
      throw new DomainError('INVALID_CREDENTIALS', 'Current password is incorrect');
    }
    user.passwordHash = hashPassword(newPassword);
    await this.deps.users.update(user);
  }
}
