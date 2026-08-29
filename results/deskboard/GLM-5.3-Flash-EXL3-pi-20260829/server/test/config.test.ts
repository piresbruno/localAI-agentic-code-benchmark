/** Tests for env config loading — fail-fast behavior on bad values. */
import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/config.js';

describe('loadConfig', () => {
  it('applies safe local defaults', () => {
    const config = loadConfig();
    expect(config.port).toBe(3000);
    expect(config.jwtSecret.length).toBeGreaterThan(10);
    expect(config.clientDistDir).toBe('../client/dist');
  });

  it('reads PORT from the environment', () => {
    process.env.PORT = '4567';
    expect(loadConfig().port).toBe(4567);
    delete process.env.PORT;
  });

  it('fails fast on a non-numeric PORT', () => {
    process.env.PORT = 'not-a-port';
    expect(() => loadConfig()).toThrow(/Invalid PORT/);
    delete process.env.PORT;
  });
});
