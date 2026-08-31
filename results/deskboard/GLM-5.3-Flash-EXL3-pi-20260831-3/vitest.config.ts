import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ['./server/vitest.config.ts', './client/vite.config.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      // Coverage gate scope per spec §2.6: server/src + shared only.
      include: ['server/src/**/*.ts', 'shared/src/**/*.ts'],
      exclude: ['server/src/main.ts', '**/*.d.ts'],
      thresholds: { lines: 75 },
    },
  },
});
