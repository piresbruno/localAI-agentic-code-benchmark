/** Configuration from environment variables with safe local defaults. Fail-fast on bad values. */
import { ruleViolationError } from '@deskboard/shared';

export interface Config {
  port: number;
  jwtSecret: string;
  /** Comma-separated list of "name|capacity|floor|features" for seeding, or undefined to use built-in defaults. */
  seedRooms: string | undefined;
  clientDistDir: string;
}

function readPort(): number {
  const raw = process.env.PORT ?? '3000';
  const port = Number.parseInt(raw, 10);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw ruleViolationError(`Invalid PORT value: ${raw}`);
  }
  return port;
}

export function loadConfig(): Config {
  return {
    port: readPort(),
    // Local default only; production deployments must set JWT_SECRET explicitly (documented in README).
    jwtSecret: process.env.JWT_SECRET ?? 'deskboard-dev-secret-do-not-use-in-production',
    seedRooms: process.env.SEED_ROOMS,
    clientDistDir: process.env.CLIENT_DIST_DIR ?? '../client/dist',
  };
}
