import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config';

describe('loadConfig', () => {
  it('applies documented local defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3000);
    expect(config.jwtSecret).toBe('dev-only-secret-change-me');
    expect(config.isProduction).toBe(false);
  });

  it('reads PORT and JWT_SECRET from the environment', () => {
    const config = loadConfig({ PORT: '8080', JWT_SECRET: 'env-secret' });
    expect(config.port).toBe(8080);
    expect(config.jwtSecret).toBe('env-secret');
  });

  it('fails fast on a non-numeric or out-of-range PORT', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(/Invalid PORT/);
    expect(() => loadConfig({ PORT: '99999' })).toThrow(/Invalid PORT/);
  });

  it('refuses to boot in production without an explicit JWT_SECRET', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });
});
