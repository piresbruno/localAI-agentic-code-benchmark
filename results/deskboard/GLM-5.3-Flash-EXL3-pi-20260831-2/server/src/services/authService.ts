import {
  AuthResponse,
  ERROR_CODES,
  LoginInput,
  RegisterInput,
  Role,
  User,
} from '@deskboard/shared';
import { PasswordHasher } from '../auth/passwords';
import { TokenIssuer, TokenPayload } from '../auth/jwt';
import { StoredUser, UserRepository } from '../repositories/types';
import { AppError } from './errors';
import { IdGen } from './ports';

/** Registration, login and identity. Password hashing + token issuing are injected ports. */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly ids: IdGen,
    private readonly hasher: PasswordHasher,
    private readonly tokens: TokenIssuer,
  ) {}

  /** Create an employee account and return a fresh JWT. */
  async register(input: RegisterInput): Promise<AuthResponse> {
    const existing = await this.users.findByEmail(input.email);
    if (existing) {
      throw new AppError(ERROR_CODES.EMAIL_IN_USE, 'An account with this email already exists');
    }
    const user = await this.users.create({
      id: this.ids.next(),
      name: input.name,
      email: input.email,
      role: 'employee',
      passwordHash: await this.hasher.hash(input.password),
    });
    return { token: this.issue(user), user: toPublicUser(user) };
  }

  /** Verify credentials and return a fresh JWT (12h expiry). */
  async login(input: LoginInput): Promise<AuthResponse> {
    const user = await this.users.findByEmail(input.email);
    const ok = user && (await this.hasher.verify(input.password, user.passwordHash));
    if (!user || !ok) {
      throw new AppError(ERROR_CODES.UNAUTHENTICATED, 'Invalid email or password');
    }
    return { token: this.issue(user), user: toPublicUser(user) };
  }

  /** Resolve the authenticated user; rejects with 401 when the account vanished. */
  async me(userId: string): Promise<User> {
    const user = await this.users.findById(userId);
    if (!user) throw new AppError(ERROR_CODES.UNAUTHENTICATED, 'Unknown account');
    return toPublicUser(user);
  }

  private issue(user: StoredUser): string {
    return this.tokens.issue({ sub: user.id, role: user.role as Role });
  }
}

function toPublicUser(user: StoredUser): User {
  const { id, name, email, role } = user;
  return { id, name, email, role };
}
