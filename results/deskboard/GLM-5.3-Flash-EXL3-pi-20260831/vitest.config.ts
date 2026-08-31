import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

const sharedAlias = fileURLToPath(new URL('./shared/src/index.ts', import.meta.url));

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: ['server/src/**', 'shared/src/**'],
      exclude: ['server/src/main.ts', '**/*.d.ts'],
    },
    projects: [
      {
        test: {
          name: 'server',
          environment: 'node',
          include: ['server/tests/**/*.test.ts'],
          alias: { '@deskboard/shared': sharedAlias },
        },
      },
      {
        plugins: [react()],
        test: {
          name: 'client',
          environment: 'jsdom',
          include: ['client/tests/**/*.test.{ts,tsx}'],
          setupFiles: ['client/tests/setup.ts'],
          alias: { '@deskboard/shared': sharedAlias },
        },
      },
    ],
  },
});
