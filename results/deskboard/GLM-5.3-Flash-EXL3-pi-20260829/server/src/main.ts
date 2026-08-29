/** Entry point: load config, create app, listen. Fail fast on bad configuration. */
import { loadConfig } from './config.js';
import { createApp } from './app.js';

const config = loadConfig();
const app = createApp(config);

app.listen(config.port, () => {
  console.log(`[deskboard] API + UI listening on http://localhost:${config.port}`);
  console.log(`[deskboard] Swagger UI at http://localhost:${config.port}/api-docs`);
});
