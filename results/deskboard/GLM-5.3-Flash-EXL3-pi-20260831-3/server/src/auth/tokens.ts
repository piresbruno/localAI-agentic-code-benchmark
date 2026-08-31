import jwt, { type SignOptions } from 'jsonwebtoken';
import type { Role } from '@deskboard/shared';

/** Claims carried by every DeskBoard token. `sub` is the user id. */
export interface TokenPayload {
  sub: string;
  name: string;
  email: string;
  role: Role;
}

/** Tokens expire after 12 hours (spec §5). */
export const TOKEN_TTL_SECONDS = 12 * 60 * 60;

export function issueToken(payload: TokenPayload, secret: string): string {
  const options: SignOptions = { expiresIn: TOKEN_TTL_SECONDS };
  return jwt.sign(payload, secret, options);
}

/** Returns the payload for a valid, unexpired token, or null otherwise. */
export function verifyToken(token: string, secret: string): TokenPayload | null {
  try {
    const result = jwt.verify(token, secret);
    if (typeof result === 'string') return null;
    return result as TokenPayload;
  } catch {
    return null;
  }
}
