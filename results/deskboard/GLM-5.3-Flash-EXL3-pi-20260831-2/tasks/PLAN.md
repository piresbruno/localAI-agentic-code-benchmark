# PLAN — deskboard

**Agent/Model**: pi / GLM-5.3-Flash-EXL3
**Started**: 2026-08-31 12:35
**Spec**: specs/01-typescript-deskboard/SPEC.md
**Mode**: attended — operator issued standing instruction "execute both projects again for benchmarking"; plan self-approved per that directive (operator questions are for interpretation only, none outstanding).

## Understanding of the task

DeskBoard is a full-stack meeting-room booking app: Express 5 REST API + JWT auth (employee/admin roles) + in-memory repositories + React 18/Vite UI served from the same origin (:3000). The hard parts: (1) the seven named business rules — business hours, conflict detection with back-to-back allowance, capacity, inactive rooms, cancellation window with role/ownership logic, computed completion status, case-insensitive room-name uniqueness — each needing an eponymous test; (2) strict layering with injected `Clock`/`IdGen` so the domain never touches express/jwt/React or wall-clock time; (3) a design-token-driven UI (6 required ui components, loading/empty/error states on every data view, a11y) with zero component libraries; (4) Swagger UI at `/api-docs` covering every endpoint; (5) LOC discipline (spec target 600–1,000 TS lines, hard cap 1,000 — see deviation D1). Coverage gate: ≥75% lines on `server/src/**` + `shared/**`; UI components excluded but need ≥6 meaningful RTL tests.

## Task breakdown

- [ ] T1 — Workspace scaffold: root package.json (workspaces shared/server/client), tsconfigs, vitest+coverage config, eslint+prettier, .env.example, run-dir .gitignore
      Accept: `npm install` + `npm run build` green on skeleton; `npm test` runs zero-test suite green.
- [ ] T2 — shared: domain types, zod schemas (register/login/room/booking/availability query), error-code constants, ApiError DTO
      Accept: builds; imported by server & client without duplication.
- [ ] T3 — Server domain base: Clock/IdGen ports, AppError, in-memory repositories behind interfaces, scrypt password hashing, JWT issue/verify (12h), auth/admin middleware
      Accept: unit tests for hashing/jwt round-trip + repo behavior pass.
- [ ] T4 — BookingService: create with all §4 rules, cancel window (organizer ≤1h before start / admin anytime / others 403), computed `completed` status, listMine
      Accept: unit tests named exactly per §4 rules pass with injected fixed Clock/IdGen.
- [ ] T5 — RoomService (create/update/deactivate, case-insensitive uniqueness) + AuthService (register employee, login, me)
      Accept: unit tests: rejects_duplicate_room_name (incl. update path), register→login→me flow, duplicate email 409.
- [ ] T6 — HTTP layer: express app factory, auth/rooms/bookings routers, shared error mapper (contract `{error:{code,message,details?}}`), 404 handler, seed module, main.ts (env validation, static UI serving, SPA fallback, /health)
      Accept: supertest integration green: auth 401/403 paths, validation 400, unknown 404, conflict 409, rule 422, health 200; fresh app per test.
- [ ] T7 — OpenAPI doc + swagger-ui-express mounted at /api-docs
      Accept: GET /api-docs serves Swagger UI; openapi.json lists every §5 endpoint.
- [ ] T8 — Client foundation: tokens.css (single source), api client wrapper, useAuth + useAsync hooks, slots/cancel logic module + unit tests
      Accept: slots + canCancel unit tests pass; no hardcoded colors/sizes outside tokens.
- [ ] T9 — UI component kit: Button, TextField, Select, Modal, Toast, Table, Spinner with required states + RTL tests (≥6 tests across ≥4 components)
      Accept: RTL tests green (variants, loading, disabled, error slot, Esc/backdrop, aria-live).
- [ ] T10 — Pages: Login/Register, RoomGrid (date picker + grid + click-to-book), BookingForm (prefill, duration 30/60/90/120, inline API errors), MyBookings (cancel window disabled+tooltip), AdminRooms (modal add/edit, deactivate), App shell/nav
      Accept: RTL tests for BookingForm submit + error display and Login submit; loading/empty/error implemented on all three data views.
- [ ] T11 — Styling: component CSS on tokens, responsive ≥360px, focus-visible rings, contrast ≥4.5:1, status ≠ color-alone
      Accept: grep finds no off-token hex/px-font sizes in components; visual smoke via built UI.
- [ ] T12 — Docs: README (goal, ≤3-cmd quickstart, architecture, env vars, seeded accounts, API summary), docs/DESIGN.md, docs/DECISIONS.md
      Accept: clean-checkout run of quickstart verified (`npm install` → `npm start` → /health 200 + UI served).
- [ ] T13 — Quality gates: build, full test suite, coverage ≥75% (server/src + shared), boot & smoke, lint clean, security self-review; fill metrics
      Accept: all gates green with recorded real numbers.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| D1 | LOC expected to exceed the 1,000 hard cap; feature set kept complete | Spec requires: 6 ui components × full state matrix, 5 pages, OpenAPI for 12 endpoints, JWT+scrypt auth, 7-rule domain. AGENTS.md: "Implement everything; landing short usually means missed features." Precedent: prior deskboard run kept full features at 2,609 LOC with documented deviation. I will keep code dense and record the real number. |
| D2 | Server + shared compile to CommonJS; client is ESM via Vite | Avoids NodeNext `.js`-extension friction; boring/robust; vitest aliases `@deskboard/shared` → `shared/src` for tests, runtime resolves workspace `dist`. |
| D3 | Booking start/end accepted as `YYYY-MM-DDTHH:mm` (naive local, minutes precision) | Spec: "ISO-8601, minutes precision" + business hours "local". Naive local strings make server-local business-hour checks deterministic and TZ-independent in tests. |
| D4 | Cancellation boundary: organizer may cancel while `now ≤ start − 60min`; exactly-60min allowed | "up to 1h before start" read as inclusive boundary; simplest reading, tested at both edges. |
| D5 | Cancel of an already-cancelled booking → 422; admin cancel allowed even after start/end | "admin anytime" taken literally; double-cancel is a rule violation, not idempotent delete. |
| D6 | `GET /rooms` returns all rooms incl. `active:false` (with flag); RoomGrid filters active client-side | AdminRooms must list deactivated rooms; no admin-scoped variant specified — one endpoint, client filters. |
| D7 | `completed` is computed on read only; stored statuses are `confirmed`/`cancelled` | Spec: "never mutate history on read; compute status". |
| D8 | Password min length 8; email uniqueness enforced (409 `EMAIL_IN_USE`) | Spec silent; obvious invariants, documented here. |
| D9 | JWT secret defaults to a documented dev value; fails fast in production if unset | Standards §3 fail-fast + spec "safe local defaults". |
| D10 | RoomGrid fetches availability per room (parallel) against the per-room endpoint | Spec fixes the endpoint shape `GET /rooms/:id/availability?date=`; N-parallel calls keep contract exactly. |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
