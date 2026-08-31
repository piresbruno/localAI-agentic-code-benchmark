import type { AuthResponse, User } from '@deskboard/shared';
import type { RegisterInput, LoginInput } from '@deskboard/shared';
import type { UserRepository, StoredUser } from '../repositories/userRepository.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { issueToken, type TokenPayload } from '../auth/tokens.js';
import type { IdGen } from './clock.js';
import { DomainError } from './errors.js';

/**
 * Account business rules: registration (always as employee), login, and
 * token issuance. JWT mechanics live in `auth/`; this layer owns the rules.
 */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly ids: IdGen,
    private readonly secret: string,
  ) {}

  async register(input: RegisterInput): Promise<AuthResponse> {
    const email = input.email.toLowerCase();
    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new DomainError('EMAIL_TAKEN', 'An account with this email already exists');
    }
    const stored: StoredUser = {
      id: this.ids.next(),
      name: input.name,
      email,
      role: 'employee',
      passwordHash: hashPassword(input.password),
    };
    const user = await this.users.create(stored);
    return { token: this.tokenFor(user), user: this.toPublicUser(user) };
  }

  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.users.findByEmail(input.email.toLowerCase());
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      // Same message for unknown email and wrong password: no account enumeration.
      throw new DomainError('UNAUTHENTICATED', 'Invalid email or password');
    }
    return { token: this.tokenFor(user), user: this.toPublicUser(user) };
  }

  async me(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new DomainError('NOT_FOUND', 'User not found');
    return this.toPublicUser(user);
  }

  private tokenFor(user: StoredUserLike): string {
    const payload: TokenPayload = {
      sub: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
    return issueToken(payload, this.secret);
  }

  private toPublicUser(user: StoredUserLike): User {
    return { id: user.id, name: user.name, email: user.email, role: user.role };
  }
}

type StoredUserLike = {
  id: string;
  name: string;
  email: string;
  role: User['role'];
  passwordHash: string;
};
