import path from 'node:path';
import { createApp } from './app';

const DEV_SECRET = 'dev-only-secret-change-me';
const port = Number(process.env.PORT ?? 3000);
const jwtSecret = process.env.JWT_SECRET ?? DEV_SECRET;

if (jwtSecret === DEV_SECRET) {
  const message = 'JWT_SECRET is unset — using the documented dev-only default.';
  if (process.env.NODE_ENV === 'production') {
    console.error(`[deskboard] refusing to boot: ${message} Set JWT_SECRET.`);
    process.exit(1);
  }
  console.warn(`[deskboard] ${message}`);
}

// client/dist sits two levels above server/dist when deployed from the monorepo.
const clientDist = process.env.CLIENT_DIST ?? path.resolve(__dirname, '../../client/dist');

createApp({ jwtSecret, clientDist }).listen(port, () => {
  console.log(`[deskboard] API + UI listening on http://localhost:${port}`);
});
