# DeskBoard Decisions

One line per non-obvious decision.

- **Auth approach**: HS256 JWT (12 h) via `jsonwebtoken`; bearer tokens; role claim (`admin`/`employee`) checked in the service layer, not just routes — routes only authenticate.
- **Password hashing**: node:crypto scrypt with per-user salt (`scrypt:salt:hash`), constant-time compare — avoids a native bcrypt dependency while keeping the sandbox self-contained.
- **JWT secret handling**: `JWT_SECRET` env var with a documented dev-only default; boot refuses to start on the default when `NODE_ENV=production`.
- **Wire format for booking times**: naive local ISO-8601 at minutes precision (`YYYY-MM-DDTHH:mm`) — JS parses offset-less datetimes as local, matching the spec's "local" business hours; server and client agree on the same convention.
- **Error mapping**: one shared mapper (`http/middleware.ts`) turns the domain `AppError` (code+status+safe message) into `{ error: { code, message, details? } }`; zod failures and malformed JSON both map to 400; unexpected errors log server-side and return a generic 500.
- **Validation source**: zod schemas in `shared/` are the single source — the server parses bodies/queries with them; client forms pre-validate with the same schemas, so the two sides can never drift.
- **Cancellation window status**: inside the closed window → 422 `CANCELLATION_WINDOW_PASSED`; 403 is reserved for actors who are neither organizer nor admin (spec marks 403 on "others never").
- **Computed completion**: `completed` is never stored; every read recomputes it from `end <= now` while the stored row stays `confirmed` — history is immutable.
- **Past bookings at creation**: not rejected (spec is silent) — only the seven named rules are enforced.
- **Adjacent slots**: overlap check is strict (`start < other.end && end > other.start`), so back-to-back bookings are allowed; only `confirmed` rows conflict, cancelled ones never block.
- **In-memory persistence**: repositories hide storage behind interfaces; the README documents the swap-in point for a real DB adapter.
- **Static UI serving**: the API serves `client/dist` with a history-API fallback for non-`/api` GETs; the fallback is integration-tested.
- **Coverage scope**: `main.ts` (boot wiring) is excluded from measurement; everything under it is exercised through the `createApp()` factory with supertest.
- **`npm start` builds first** so a clean checkout works with exactly `npm install && npm start`.
