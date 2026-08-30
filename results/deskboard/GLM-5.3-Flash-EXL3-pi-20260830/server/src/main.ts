/** Production entrypoint: boots the composed app on the configured port. */
import { createApp } from './app.js';

const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET ?? 'dev-only-secret-change-me';

const app = createApp({ jwtSecret });

app.express.listen(port, () => {
  console.log(`[deskboard] API + UI listening on http://localhost:${port}`);
  console.log('[deskboard] API docs at /api-docs, health at /api/health');
});
