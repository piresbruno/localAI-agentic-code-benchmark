/** Application configuration parsed from the environment; fails fast on bad values. */
export interface AppConfig {
  port: number;
  jwtSecret: string;
  isProduction: boolean;
}

const DEV_JWT_SECRET = 'dev-only-secret-change-me';

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const isProduction = env.NODE_ENV === 'production';
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port <= 0 || port > 65535) {
    throw new Error(`Invalid PORT value: ${env.PORT ?? '(unset)'}`);
  }
  if (isProduction && !env.JWT_SECRET) {
    throw new Error('JWT_SECRET must be set when NODE_ENV=production');
  }
  return { port, jwtSecret: env.JWT_SECRET ?? DEV_JWT_SECRET, isProduction };
}
