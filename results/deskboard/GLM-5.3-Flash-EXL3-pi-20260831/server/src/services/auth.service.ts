import type { AuthResponseDto, UserDto } from '@deskboard/shared';
import type { LoginInput, RegisterInput } from '@deskboard/shared';
import { hashPassword, verifyPassword } from '../auth/password';
import { issueToken, type AuthUser } from '../auth/jwt';
import type { Clock, IdGen } from './clock';
import { conflict, notFound, unauthenticated } from './errors';
import type { UserEntity, UserRepository } from '../repositories/types';

/** Registration/login/me — issues 12h JWTs; role assignment fixed to employee on register. */
export class AuthService {
  constructor(
    private users: UserRepository,
    private clock: Clock,
    private ids: IdGen,
    private jwtSecret: string,
  ) {}

  register(input: RegisterInput): AuthResponseDto {
    if (this.users.findByEmail(input.email)) {
      throw conflict('EMAIL_TAKEN', 'An account with this email already exists.');
    }
    const user: UserEntity = {
      id: this.ids.next(),
      name: input.name,
      email: input.email,
      role: 'employee',
      passwordHash: hashPassword(input.password),
      createdAt: this.clock.now().toISOString(),
    };
    this.users.create(user);
    return { token: this.token(user), user: toUserDto(user) };
  }

  login(input: LoginInput): AuthResponseDto {
    const user = this.users.findByEmail(input.email);
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      throw unauthenticated('Invalid email or password.');
    }
    return { token: this.token(user), user: toUserDto(user) };
  }

  me(auth: AuthUser): UserDto {
    const user = this.users.findById(auth.sub);
    if (!user) throw notFound('User');
    return toUserDto(user);
  }

  private token(user: UserEntity): string {
    return issueToken({ sub: user.id, role: user.role, name: user.name }, this.jwtSecret);
  }
}

export function toUserDto(user: UserEntity): UserDto {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
