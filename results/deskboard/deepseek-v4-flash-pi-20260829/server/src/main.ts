import { createApp, DEFAULT_JWT_SECRET } from './app.js';

const port = Number(process.env.PORT ?? 3000);

if (!process.env.JWT_SECRET) {
  console.warn(
    `[deskboard] JWT_SECRET not set — using the local development default "${DEFAULT_JWT_SECRET}". Set JWT_SECRET in production.`,
  );
}

const app = createApp();
app.listen(port, () => {
  console.log(
    `DeskBoard API listening on http://localhost:${port} (UI + /api-docs served from this origin)`,
  );
});
