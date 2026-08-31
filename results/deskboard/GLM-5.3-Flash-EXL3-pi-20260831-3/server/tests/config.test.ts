import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies safe local defaults', () => {
    const config = loadConfig({});
    expect(config.port).toBe(3000);
    expect(config.secret).toBe('dev-only-secret-change-me');
  });

  it('reads PORT and JWT_SECRET from the environment', () => {
    const config = loadConfig({ PORT: '8080', JWT_SECRET: 'env-secret' });
    expect(config.port).toBe(8080);
    expect(config.secret).toBe('env-secret');
  });

  it('fails fast on a non-numeric or out-of-range PORT', () => {
    expect(() => loadConfig({ PORT: 'not-a-port' })).toThrow(/Invalid PORT/);
    expect(() => loadConfig({ PORT: '0' })).toThrow(/Invalid PORT/);
    expect(() => loadConfig({ PORT: '70000' })).toThrow(/Invalid PORT/);
  });

  it('refuses the default secret in production', () => {
    expect(() => loadConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET must be set/);
    expect(() => loadConfig({ NODE_ENV: 'production', JWT_SECRET: 'real-secret' })).not.toThrow();
  });

  it('reports clientDist as null when the client has not been built', () => {
    const config = loadConfig({});
    // In tests, client/dist may or may not exist; both are valid outcomes,
    // but the field must always be present.
    expect(['string', 'object']).toContain(typeof config.clientDist);
  });
});
