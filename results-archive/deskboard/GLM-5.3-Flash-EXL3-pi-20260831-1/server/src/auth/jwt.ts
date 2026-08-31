import jwt from 'jsonwebtoken';
import type { Role } from '@deskboard/shared';

export const TOKEN_TTL_HOURS = 12;

/** Authenticated actor carried through the service layer. */
export interface AuthUser {
  sub: string;
  role: Role;
  name: string;
}

export function issueToken(user: AuthUser, secret: string): string {
  return jwt.sign(user, secret, { expiresIn: `${TOKEN_TTL_HOURS}h` });
}

/** Returns claims or null for missing/expired/tampered tokens — callers map that to 401. */
export function verifyToken(token: string, secret: string): AuthUser | null {
  try {
    const payload = jwt.verify(token, secret);
    if (typeof payload === 'string') return null;
    const { sub, role, name } = payload as Record<string, unknown>;
    if (typeof sub !== 'string' || (role !== 'admin' && role !== 'employee')) return null;
    return { sub, role, name: String(name) };
  } catch {
    return null;
  }
}
