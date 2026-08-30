import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      'deskboard-shared': fileURLToPath(
        new URL('./shared/src/index.ts', import.meta.url)
      )
    }
  },
  test: {
    environment: 'node',
    include: [
      'server/src/**/*.test.ts',
      'shared/src/**/*.test.ts',
      'client/src/**/*.test.ts',
      'client/src/**/*.test.tsx'
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['server/src/**/*.ts', 'shared/src/**/*.ts'],
      exclude: [
        '**/*.test.ts',
        'server/src/main.ts',
        'server/src/http/openapi.ts'
      ],
      thresholds: {
        lines: 75
      }
    }
  }
});
