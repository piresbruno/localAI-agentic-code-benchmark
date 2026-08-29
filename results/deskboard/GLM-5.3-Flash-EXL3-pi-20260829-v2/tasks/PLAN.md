# PLAN — deskboard

**Agent/Model**: pi
**Started**: 2026-08-29
**Spec**: specs/01-typescript-deskboard/SPEC.md
**Mode**: unattended (plan self-approved)

## Understanding of the task

DeskBoard is a meeting-room booking app: REST API (Express 5, JWT, in-memory persistence) + React 18/Vite UI served from the same origin. Hard parts: business rules must live only in `server/src/services` with injected `Clock`/`IdGen`; 8 named business rules (business hours, conflict 409, weekly recurrence all-or-nothing, capacity 422, cancellation window, computed completion status, admin-only room management, case-insensitive room-name uniqueness); shared zod schemas used by both sides; a real design system (tokens + 8 UI components) with loading/empty/error states and a11y; OpenAPI at `/api-docs`; ≥75% line coverage on `server/src` + `shared` plus ≥8 RTL tests.

## Task breakdown

- [ ] T1 — Scaffold workspaces (server/client/shared), tsconfig, eslint, vitest; build green
      Accept: `npm run build` passes on empty skeleton.
- [ ] T2 — `shared/` DTOs + zod validation schemas (auth, room, booking, usage, error contract)
      Accept: shared builds; schemas exported.
- [ ] T3 — Domain: domain types, errors, `Clock`/`IdGen` interfaces, booking rules service
      Accept: unit tests named for all 8 §4 rules pass.
- [ ] T4 — Repositories (in-memory, interfaces) + seed (rooms + admin)
      Accept: repo unit tests pass; seed boots app data.
- [ ] T5 — Auth service: register/login, bcrypt hashing, JWT issue/verify, password change
      Accept: unit tests for auth paths (dup email, bad credentials, token expiry).
- [ ] T6 — HTTP layer: routers, auth middleware, shared error mapper (400/401/403/404/409/422), OpenAPI JSON + Swagger UI
      Accept: supertest integration tests for every §5 endpoint incl. 401/403 pass.
- [ ] T7 — Client foundation: tokens.css, ui components (Button, TextField, Select, Modal, Toast, Badge, Table, Spinner), a11y
      Accept: ≥4 component RTL tests pass.
- [ ] T8 — Client logic modules: api wrapper, slot computation, booking validation — unit tested
      Accept: unit tests for slot math + error display mapping pass.
- [ ] T9 — Pages: Login/Register, RoomGrid, BookingForm, MyBookings, AdminRooms + app shell/routing
      Accept: RTL test for booking submit flow; loading/empty/error states present in each data view.
- [ ] T10 — Coverage + quality gates: `npm run coverage` ≥75% on server+shared; eslint zero warnings; smoke boot
      Accept: all gates green.
- [ ] T11 — Docs: README quickstart, docs/DESIGN.md, docs/DECISIONS.md
      Accept: README ≤3 commands clean checkout → running.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed + avg output t/s:
- Errors/retries:
- Final coverage:
- Line counts per directory:
- Deviations from spec:
