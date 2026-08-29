/**
 * JWT issue/verify (12h expiry). The service layer never touches tokens:
 * the HTTP boundary converts a successful login/register into a token.
 */
import jwt from 'jsonwebtoken';
import type { Role } from 'shared';
import { TOKEN_TTL_HOURS } from 'shared';

const ISSUER = 'deskboard';

export interface TokenPayload {
  sub: string;
  role: Role;
}

/** Issue a signed access token for a user. */
export function issueToken(secret: string, userId: string, role: Role): string {
  return jwt.sign({ role }, secret, {
    subject: userId,
    issuer: ISSUER,
    expiresIn: `${TOKEN_TTL_HOURS}h`,
  });
}

/** Verify a token and return its payload; throws on any invalid token. */
export function verifyToken(secret: string, token: string): TokenPayload {
  const decoded = jwt.verify(token, secret, { issuer: ISSUER });
  if (typeof decoded === 'string' || typeof decoded.sub !== 'string') {
    throw new Error('invalid token payload');
  }
  if (decoded.role !== 'admin' && decoded.role !== 'employee') {
    throw new Error('invalid token role');
  }
  return { sub: decoded.sub, role: decoded.role };
}
