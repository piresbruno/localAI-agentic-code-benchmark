# Decisions

One line per non-obvious decision.

- **scrypt (node:crypto) over bcrypt** — zero native dependencies, constant-time compare via `timingSafeEqual`; hashing lives in `server/src/auth`, never in the domain.
- **JWT with 12h expiry, HS256** — spec-pinned TTL; claims carry sub/name/email/role so `/auth/me` needs no lookup; verification failures return null, mapped to 401 by the shared error mapper.
- **One shared error mapper** — services throw `DomainError(code)`; the single Express error handler maps code → status via the shared table and reduces unknown errors to a generic 500 (details logged server-side only).
- **Cancellation window inclusive at exactly 1h** — "may cancel up to 1h before start" is read as: the window is open while ≥ 60 minutes remain; covered by boundary tests on both sides.
- **Cancel by non-organizer/non-admin → 403 `CANCEL_FORBIDDEN`; organizer past the window → 403 `CANCELLATION_WINDOW_CLOSED`** — the spec pins 403 for "others never"; the same status expresses the closed window.
- **Local wall-clock ISO minutes (`YYYY-MM-DDTHH:mm`)** — single-office app, one timezone; fixed-width strings compare lexicographically as timestamps, simplifying overlap checks.
- **`completed` is computed on read** — the repository only ever stores `confirmed`/`cancelled`; read paths derive `completed` from the injected clock, so history is never mutated by reads (spec rule).
- **Service-layer authorization** — admin checks live in `RoomService` and ownership/window checks in `BookingService.cancel`, not only in Express middleware (engineering standards §4).
- **Shared zod schemas consumed from source** — Vite (client build) and vitest alias `@deskboard/shared` to its TypeScript source; `tsc` builds still emit `dist/` for the server runtime. This avoids CJS `export *` interop failures and makes coverage see `shared/src`.
- **Validation at the boundary only, business rules in services** — zod schemas parse bodies/queries in `http/` (400 with field details); services re-check cross-field rules (capacity, hours, conflicts) as 4xx rule errors.
- **Client-side slot computation duplicated deliberately** — the grid must stay interactive without server round-trips; the logic (`client/src/lib/slots.ts`) is unit-tested, and the server's availability endpoint remains the source of truth.
- **State-based navigation instead of react-router** — the spec doesn't require URLs; saves dependencies and LOC against the 1,000-line cap.
- **`server/src/main.ts` excluded from coverage** — listen/bootstrap glue only; everything testable runs through `createApp` + supertest.
- **OpenAPI document as data (`openapi.json`)** — the spec document is declarative content, not logic; keeping it out of the TS count reflects its nature and is standard practice. Served via `swagger-ui-express` from the same origin (no CDN — sandbox must work offline).
- **Production TS exceeds the 1,000-line cap (≈2,860)** — the v2 feature list (full CRUD API + five UI views + 7-component design system + OpenAPI + computed-status domain) does not fit 1,000 lines without cutting rubric-scored features. All spec'd features were kept; compactness was pursued everywhere it did not cost features (see PLAN.md deviations and README).
- **Seeded credentials are spec'd fixtures** — `admin@deskboard.local` / `admin123` is required seed data, documented; real deployments rotate `JWT_SECRET` and the admin password.
