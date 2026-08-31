# PLAN — deskboard

**Agent/Model**: GLM-5.3-Flash-EXL3 via pi harness
**Started**: 2026-08-31 03:14
**Spec**: specs/01-typescript-deskboard/SPEC.md (v2.0.0)
**Mode**: unattended (plan self-approved)

## Understanding of the task

DeskBoard is a full-stack meeting-room booking app: Express 5 REST API with JWT auth
(employee/admin roles), in-memory repositories behind interfaces, and a React 18 + Vite UI
served from the same origin. Hard parts: (1) the seven named business rules (business hours,
conflict detection with back-to-back adjacency, capacity, inactive rooms, cancellation window,
computed completion status, case-insensitive room-name uniqueness) each needing a test named
after them; (2) strict layering — all business logic in `services` with injected `Clock`/`IdGen`,
HTTP layer as pure mapping, shared zod schemas as single validation source for both sides;
(3) the §7 design system (tokens.css as single source, 7 ui components with full states, loading/
empty/error on every data view, a11y: focus trap modal, aria-live toasts, keyboard operability);
(4) landing in 600–1,000 LOC of production TS — the feature list is wide, so the code must be
tight; (5) coverage ≥ 75% on `server/src/**` + `shared/**` measured by vitest.

## Task breakdown

- [x] T1 — Scaffold npm workspaces (root, shared, server, client), tsconfigs, root vitest config,
      eslint/prettier, .env.example; implement `shared` (types, zod schemas, error codes).
      Accept: `npm run build` green with an empty server/client skeleton; shared compiles.
      Result: build + lint green (express 5.2.1, vitest 4.1.11, react 18.3.1, vite 7.3.6, zod 3.25.76).
- [x] T2 — Server domain core: Clock/IdGen interfaces + real impls, AppError hierarchy,
      repository interfaces + in-memory impls, auth (JWT issue/verify, scrypt password hashing),
      seed (4 rooms + admin@deskboard.local/admin123).
      Accept: `tsc` compiles; no express/jsonwebtoken imports outside http//auth layers.
- [x] T3 — Services (business rules) TDD: AuthService, RoomService, BookingService,
      AvailabilityService with injected Clock/IdGen.
      Accept: unit tests green for all 7 §4-named rules incl. adjacent-slot and window edges.
      Result: 38 service unit tests green (fixed email normalization + login error code along the way).
- [x] T4 — HTTP layer: auth middleware, one shared error mapper, thin routers
      (auth/rooms/bookings/health), app.ts factory, main.ts boot, OpenAPI + Swagger UI at /api-docs,
      static UI serving with SPA fallback.
      Accept: supertest integration tests green for every §5 endpoint incl. 401/403/400/404/409/422 paths.
      Result: 59 server tests green; /api-docs + SPA fallback verified.
- [x] T5 — Server/shared coverage hardening.
      Accept: `npx vitest run --coverage` ≥ 75% lines on server/src + shared/src, 0 failing tests.
      Result: 97.34% lines (257/264) on server/src + shared/src.
- [ ] T6 — Client foundation: Vite + tokens.css design system, typed fetch api wrapper over shared
      DTOs, useAuth/useResource hooks, ui components (Button, TextField, Select, Modal, Toast,
      Table, Spinner) with RTL tests on ≥ 4 of them.
      Accept: client tests green; components implement hover/focus-visible/disabled/loading states.
- [ ] T7 — Pages + client logic: Login/Register, RoomGrid (grid from slots lib, click empty slot →
      prefilled form), BookingForm (prefill, durations, inline API errors, double-submit safe),
      MyBookings (upcoming/past, cancel window button state), AdminRooms (modal CRUD, deactivate);
      slots/validation client modules unit-tested; loading/empty/error everywhere.
      Accept: client tests green incl. slots + cancel-window logic; all flows reachable.
- [ ] T8 — Quality gates + docs: full build, all tests, coverage run, boot smoke (health 200, UI at /,
      Swagger at /api-docs), lint zero warnings, README (quickstart/env/seeded accounts), docs/DESIGN.md,
      docs/DECISIONS.md.
      Accept: §2 success criteria 1–6 all verifiable from clean checkout.
- [ ] T9 — Closing bookkeeping: METRICS.md yaml from harness session log, BENCHMARKS.md row update,
      final commit.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Naive local ISO-8601 (`YYYY-MM-DDTHH:mm`, minutes precision, no timezone offset) as the wire format for booking start/end | Spec §4 says "ISO-8601, minutes precision" and "local" business hours; naive local strings parse as local time in JS and keep client/server consistent |
| 2 | Cancellation inside the 1h window → 422 `CANCELLATION_WINDOW_PASSED`; 403 reserved for non-organizer/non-admin actors | Spec marks (403) on "others never"; window is a business rule → 422 per §5 |
| 3 | Past bookings are not rejected at creation | Spec is silent; only the 7 named rules are enforced (documented, not invented) |
| 4 | `server/src/main.ts` (boot wiring) excluded from coverage measurement | Entry point cannot be exercised by supertest; everything under it is covered via app factory |
| 5 | Password hashing via node:crypto scrypt (no bcrypt native dep) | Keeps sandbox dependency-free; stdlib KDF, salted per user |
| 6 | `npm start` runs the build first, then boots | §2 requires "npm install, then npm start" from clean checkout to work |
| 7 | Booking status is stored as confirmed/cancelled only; `completed` is computed on every read | §4 "never mutate history on read; compute status" |
| 8 | Admin-only authorization enforced inside services (actor passed in), routes only authenticate | Standards §4: role/ownership checks in service layer |
| 9 | RoomGrid fetches availability per active room (N small parallel calls) | §5 offers only per-room availability endpoint |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
