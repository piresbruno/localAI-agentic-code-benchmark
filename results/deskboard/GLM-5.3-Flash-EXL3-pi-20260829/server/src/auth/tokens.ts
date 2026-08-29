/** JWT issuing and verification. Tokens expire after 12 hours. */
import jwt from 'jsonwebtoken';
import type { PublicUser, Role } from '@deskboard/shared';

const TOKEN_TTL_HOURS = 12;

export interface TokenPayload {
  sub: string;
  role: Role;
  name: string;
  email: string;
}

export class TokenService {
  constructor(private readonly secret: string) {}

  issue(user: PublicUser): string {
    const payload: TokenPayload = { sub: user.id, role: user.role, name: user.name, email: user.email };
    return jwt.sign(payload, this.secret, { expiresIn: `${TOKEN_TTL_HOURS}h` });
  }

  verify(token: string): TokenPayload {
    return jwt.verify(token, this.secret) as TokenPayload;
  }
}
