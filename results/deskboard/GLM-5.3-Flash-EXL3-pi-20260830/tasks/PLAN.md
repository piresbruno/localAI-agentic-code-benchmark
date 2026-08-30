# PLAN — deskboard

**Agent/Model**: pi (model: GLM-5.3-Flash-EXL3)
**Started**: 2026-08-30
**Spec**: specs/01-typescript-deskboard/SPEC.md
**Mode**: unattended (plan self-approved)

## Understanding of the task

DeskBoard is a meeting-room booking app: REST API (Express 5, JWT, in-memory persistence) + React 18/Vite UI served from the same origin. Hard parts: business rules must live only in `server/src/services` with injected `Clock`/`IdGen`; 8 named business rules (business hours, conflict 409, weekly recurrence all-or-nothing, capacity 422, cancellation window, computed completion status, admin-only room management, case-insensitive room-name uniqueness); shared zod schemas used by both sides; a real design system (tokens + 8 UI components) with loading/empty/error states and a11y; OpenAPI at `/api-docs`; ≥75% line coverage on `server/src` + `shared` plus ≥8 RTL tests.

## Task breakdown

- [x] T1 — Scaffold workspaces (server/client/shared), tsconfig, eslint, vitest; build green
      Accept: `npm run build` passes on empty skeleton.
- [x] T2 — `shared/` DTOs + zod validation schemas (auth, room, booking, usage, error contract)
      Accept: shared builds; schemas exported. (19 schema/contract tests)
- [x] T3 — Domain: domain types, errors, `Clock`/`IdGen` interfaces, booking rules service
      Accept: unit tests named for all 8 §4 rules pass. (8 rules covered across booking/room service tests)
- [x] T4 — Repositories (in-memory, interfaces) + seed (rooms + admin)
      Accept: repo unit tests pass; seed boots app data.
- [x] T5 — Auth service: register/login, scrypt password hashing, JWT issue/verify, password change
      Accept: unit tests for auth paths (dup email, bad credentials, token expiry). (expiry asserted via 12h exp claim)
- [x] T6 — HTTP layer: routers, auth middleware, shared error mapper (400/401/403/404/409/422), OpenAPI JSON + Swagger UI
      Accept: supertest integration tests for every §5 endpoint incl. 401/403 pass. (18 integration tests)
- [x] T7 — Client foundation: tokens.css, ui components (Button, TextField, Select, Modal, Toast, Badge, Table, Spinner), a11y
      Accept: ≥4 component RTL tests pass. (Button/TextField/Modal/Badge/Table/Toast suites)
- [x] T8 — Client logic modules: api wrapper, slot computation, booking validation — unit tested
      Accept: unit tests for slot math + error display mapping pass.
- [x] T9 — Pages: Login/Register, RoomGrid, BookingForm, MyBookings, AdminRooms + app shell/routing
      Accept: RTL test for booking submit flow; loading/empty/error states present in each data view.
- [x] T10 — Coverage + quality gates: `npm run coverage` ≥75% on server+shared; eslint zero warnings; smoke boot
      Accept: all gates green. (96.08% lines, 114/114 tests, lint clean, smoke: /api/health 200 + UI at / + docs)
- [x] T11 — Docs: README quickstart, docs/DESIGN.md, docs/DECISIONS.md
      Accept: README ≤3 commands clean checkout → running.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| D1 | `DELETE /rooms/:id` soft-deactivates (sets `active=false`) per spec; response 200 with updated room | Spec says DELETE = soft-deactivate; no body deletion involved. |
| D2 | `recurrence: { kind: 'none' } \| { kind: 'weekly', count: 2–12 }`, expanded to one stored occurrence per week | Spec leaves the exact shape open; occurrence records keep conflict checks and per-occurrence cancellation simple. |
| D3 | JWT 12h expiry, HS256, secret from `JWT_SECRET` env (dev default documented) | Spec §5; secret via env per engineering standards §4. |
| D4 | Password hashing with Node `crypto.scrypt` (no native bcrypt dep) | Avoids native-build risk; hashing lives in `server/src/auth`. |
| D5 | `completed` is computed on read, never persisted | Spec §4 `marks_completed_bookings`. |
| D6 | Cancel of an already-cancelled booking → 409 `BOOKING_ALREADY_CANCELLED`; wrong current password → 403 | Spec silent on these edges; chosen within the 409/403 families of the error contract. |
| D7 | Room availability served per-room via `/rooms/:id/availability` (server-computed grid) | `GET /bookings` is role-scoped (employee = own), so employees need a server-side view of all bookings for the grid. |
| D8 | Registration email uniqueness → 409 `EMAIL_IN_USE`; weekly `count` min 2 (1 week = plain booking) | Spec silent; consistent with the error contract and recurrence semantics. |

## Final report (fill at the end)

- Wall-clock time: 01:22:40 (session telemetry 08:58:48 → 10:21:28; includes ~4 min of pre-run ping)
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
  Self-reported from pi session telemetry (PI_SESSION_FILE): 141 model requests, cumulative output ≈ 110,776 tokens, final context ≈ 164,391 tokens (input is a cumulative per-request figure — total-request count not directly summable). avg output t/s ≈ 27.4 (output ÷ wall time).
- Errors/retries (build/test/lint): 1 npm peer-dependency conflict (eslint-plugin-react-hooks v4 vs eslint 9 → upgraded to v5); 2 rounds of test failures fixed forward (Express 5 `req.query` getter, test expectation bugs); 0 restarts.
- Final coverage (number + measurement command): 96.08% lines via `npx vitest run --coverage` (gate: server/src + shared/src, threshold 75).
- Line counts per directory: server/src 2,902 · shared/src 430 · client/src 3,085 (total 6,417 incl. tests+CSS; non-test TS+CSS 4,272, tests 2,145).
- Deviations from spec: see table above (none blocking; spec-silent edges decided and documented).
