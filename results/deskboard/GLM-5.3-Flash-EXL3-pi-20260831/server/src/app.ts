import express from 'express';

/** App factory — replaced by the full HTTP layer in T4; kept minimal so T1 builds. */
export function createApp(): express.Express {
  const app = express();
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });
  return app;
}
