import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'test/**/*.test.ts'],
  },
  coverage: {
    provider: 'v8',
    all: true,
    include: ['src/**/*.ts', '../shared/src/**/*.ts'],
    exclude: ['src/main.ts', '**/*.test.ts', '**/dist/**'],
    reporter: ['text', 'json-summary'],
  },
});
