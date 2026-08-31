import type { TokenPayload } from '../auth/tokens.js';

/** Express request augmentation: `req.user` is set by `requireAuth`. */
declare module 'express-serve-static-core' {
  interface Request {
    user?: TokenPayload;
  }
}

export type { TokenPayload };
