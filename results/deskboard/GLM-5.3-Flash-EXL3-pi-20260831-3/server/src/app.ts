import express from 'express';

/** Minimal skeleton — routers, middleware and services arrive in T3–T6. */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  return app;
}
