import { Role } from '@deskboard/shared';
import jwt from 'jsonwebtoken';

export interface TokenPayload {
  sub: string;
  role: Role;
}

const TOKEN_TTL = '12h';

/** Issue a signed JWT (12h expiry) for a user id + role. */
export function issueToken(payload: TokenPayload, secret: string): string {
  return jwt.sign(payload, secret, { expiresIn: TOKEN_TTL });
}

/** Verify a JWT and return its payload, or null when invalid/expired/malformed. */
export function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, secret);
    if (typeof decoded === 'string') return null;
    const { sub, role } = decoded as jwt.JwtPayload;
    const validRole = role === 'admin' || role === 'employee';
    return typeof sub === 'string' && validRole ? { sub, role } : null;
  } catch {
    return null;
  }
}
