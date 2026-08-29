/** Auth middleware: token validation on every protected route. Role decisions live in services. */
import type { NextFunction, Request, Response } from 'express';
import { unauthenticatedError, type PublicUser } from '@deskboard/shared';
import type { TokenService } from '../auth/tokens.js';
import type { AuthService } from '../services/authService.js';

export interface AuthedRequest extends Request {
  user?: PublicUser;
}

export class AuthMiddleware {
  constructor(
    private readonly tokens: TokenService,
    private readonly auth: AuthService,
  ) {}

  /** Extracts and verifies the Bearer JWT, resolves the user, and attaches it to the request. */
  requireAuth = (req: AuthedRequest, _res: Response, next: NextFunction): void => {
    const header = req.headers.authorization;
    if (!header?.startsWith('Bearer ')) {
      next(unauthenticatedError('Missing Authorization header'));
      return;
    }
    try {
      const payload = this.tokens.verify(header.slice('Bearer '.length));
      const user = this.auth.requireUser(payload.sub);
      req.user = user;
      next();
    } catch {
      next(unauthenticatedError('Invalid or expired token'));
    }
  };
}
