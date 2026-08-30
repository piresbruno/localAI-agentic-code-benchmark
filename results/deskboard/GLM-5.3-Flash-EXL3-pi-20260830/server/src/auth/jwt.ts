/**
 * JWT issuing and verification. Tokens carry the user id and role and
 * expire after 12 hours (spec §5).
 */
import jwt from 'jsonwebtoken';
import { AppError, unauthenticated, type PublicUser, type Role } from 'deskboard-shared';

export const TOKEN_TTL_HOURS = 12;

export interface TokenPayload {
  sub: string;
  role: Role;
}

export interface TokenService {
  issue(user: PublicUser): string;
  verify(token: string): TokenPayload;
}

export const createTokenService = (secret: string): TokenService => ({
  issue(user: PublicUser): string {
    return jwt.sign({ sub: user.id, role: user.role }, secret, {
      expiresIn: `${TOKEN_TTL_HOURS}h`
    });
  },

  verify(token: string): TokenPayload {
    try {
      const payload = jwt.verify(token, secret);
      if (typeof payload === 'string' || typeof payload.sub !== 'string') {
        throw new Error('malformed token payload');
      }
      return { sub: payload.sub, role: payload.role };
    } catch {
      throw unauthenticated('Invalid or expired token');
    }
  }
});

export const bearerTokenFrom = (header: string | undefined): string | null => {
  if (!header?.startsWith('Bearer ')) return null;
  const token = header.slice('Bearer '.length).trim();
  return token.length > 0 ? token : null;
};

export { AppError };
