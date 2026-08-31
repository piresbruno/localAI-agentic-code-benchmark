# PLAN — deskboard

**Agent/Model**: GLM-5.3-Flash-EXL3 / pi
**Started**: 2026-08-31
**Spec**: specs/01-typescript-deskboard/SPEC.md
**Mode**: attended (operator approved "Start implementation now")

## Understanding of the task

DeskBoard is a single-office meeting-room booking app: employees register/login (JWT, 12h) and book rooms; admins manage rooms. Full-stack TypeScript monorepo (npm workspaces) — Express 5 API with in-memory repositories, React 18 + Vite SPA served from the same origin, and a `shared` workspace holding DTOs/types/zod schemas used by both sides. Hard parts: (1) the seven named business rules — business hours, overlap conflicts, capacity, inactive rooms, cancellation window, computed `completed` status, duplicate room names — each needing a test with that exact name; (2) strict layering — all business rules in `services/`, pure domain with injected `Clock`/`IdGen`, Express kept out of the domain; (3) a design-token-driven UI with loading/empty/error states, a11y basics, and the §7.2 component inventory; (4) the 1,000-line production-TS cap, which forces compact, boring code.

## Task breakdown

- [x] T1 — Scaffold workspaces (root, shared, server, client) + toolchain (tsconfig, ESLint, Prettier, vitest)
      Accept: `npm run build` green on empty skeletons; lint clean.
- [x] T2 — `shared`: domain types, error codes, zod schemas (single source both sides)
      Accept: shared builds; types consumed by server skeleton.
- [x] T3 — Server `auth/`: scrypt password hashing, JWT issue/verify, AuthService; unit tests
      Accept: unit tests for register/login/verify pass with injected deps.
- [x] T4 — Server `repositories/`: interfaces + in-memory implementations (users, rooms, bookings)
      Accept: unit tests cover repo behaviors (uniqueness, soft-deactivate, lookups).
- [x] T5 — Server `services/`: BookingService (all 7 §4 rules) + RoomService with injected Clock/IdGen; unit tests named per spec
      Accept: all 7 named rule tests green, plus cancellation-window matrix (organizer/admin/other).
- [x] T6 — Server `http/`: routers, auth middleware, shared error mapper, OpenAPI doc, `app.ts`/`main.ts`; supertest integration tests (fresh app per test)
      Accept: every §5 endpoint tested incl. 401/403/400/404/409/422 paths; `GET /api-docs` serves Swagger UI.
- [x] T7 — `seed/`: default rooms + seeded admin; wire boot; smoke via `npm start`
      Accept: `npm start` → `GET /health` 200; admin@deskboard.local can login.
- [ ] T8 — Client foundation: `tokens.css`, typed api wrapper, auth/data hooks, ui components (Button, TextField, Select, Modal, Toast, Table, Spinner) + RTL design-system tests
      Accept: ≥4 design-system components RTL-tested (variants, error state, disabled, aria).
- [ ] T9 — Client pages: Login, RoomGrid (+ unit-tested slot computation), BookingForm, MyBookings, AdminRooms; RTL tests
      Accept: ≥6 meaningful RTL tests; form submit asserts API call + inline error display.
- [x] T10 — Coverage & hardening pass: ≥75% lines on server/src + shared; a11y & double-submit checks
      Accept: `npm run coverage` reports ≥75% lines on gate scope; all tests green.
- [x] T11 — Docs: README, docs/DESIGN.md, docs/DECISIONS.md, .env.example
      Accept: clean-checkout quickstart ≤3 commands works.
- [x] T12 — Final gates + bookkeeping: build/test/coverage/smoke run, PLAN/RESULT/METRICS updated, BENCHMARKS.md row updated
      Accept: §6 Step 5 quality gates all green; final report printed.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Password hashing via node:crypto scrypt (no bcrypt dep) | Pure-Node, zero native builds in sandbox; equivalent security |
| 2 | Cancel too-late (organizer past 1h window) → 403 CANCELLATION_WINDOW_CLOSED; non-organizer non-admin → 403 CANCEL_FORBIDDEN | Spec fixes 403 for "others never"; extends same status to organizer-outside-window as a forbidden action |
| 3 | Booking start/end as local wall-clock ISO `YYYY-MM-DDTHH:mm` (no TZ offset) | Spec: "Mon–Fri 08:00–19:00 local"; single-office app, one timezone |
| 4 | Slot/busy computation for the grid done in a unit-tested client module (`client/src/lib/slots.ts`); server also exposes availability endpoint | Spec §6 requires client-side rule logic unit-tested; server endpoint required by §5 |
| 5 | `server/src/main.ts` (listen/bootstrap) excluded from coverage scope | Entry-point glue; everything testable is covered via supertest on `app.ts` |
| 6 | State-based page navigation (no react-router) | Spec doesn't require URLs; fewer deps, fewer LOC toward the 1,000 cap |
| 7 | Inactive-room booking rejected with 409 `ROOM_INACTIVE` | Spec pins 409 for inactive rooms but not the code name |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
