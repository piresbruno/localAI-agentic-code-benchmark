import express from 'express';

/**
 * Create the Express application (no listening). Used by main.ts and tests.
 */
export function createApp(): express.Express {
  const app = express();
  app.use(express.json());

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return app;
}
