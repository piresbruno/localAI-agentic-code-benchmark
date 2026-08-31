import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

export interface AppConfig {
  port: number;
  secret: string;
  /** Built SPA directory, or null when the client has not been built. */
  clientDist: string | null;
}

const DEFAULT_SECRET = 'dev-only-secret-change-me';

/**
 * Reads configuration from the environment with safe local defaults
 * (spec §2.2). Invalid values fail fast at startup.
 */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT: ${String(env.PORT)}`);
  }
  const secret = env.JWT_SECRET || DEFAULT_SECRET;
  if (secret === DEFAULT_SECRET && env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be set in production');
  }
  const clientDist = resolve(__dirname, '../../client/dist');
  return { port, secret, clientDist: existsSync(clientDist) ? clientDist : null };
}
