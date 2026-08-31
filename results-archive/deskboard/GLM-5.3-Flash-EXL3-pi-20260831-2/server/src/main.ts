import { loadConfig } from './config';
import { createApp } from './app';

async function main(): Promise<void> {
  const config = loadConfig(process.env);
  const app = await createApp(config);
  app.listen(config.port, () => {
    console.log(`DeskBoard listening on http://localhost:${config.port} (UI + API)`);
  });
}

main().catch((err: unknown) => {
  console.error('Failed to start DeskBoard:', err instanceof Error ? err.message : err);
  process.exit(1);
});
