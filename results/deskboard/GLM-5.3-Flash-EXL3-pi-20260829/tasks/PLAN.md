# PLAN — deskboard

**Agent/Model**: GLM-5.3-Flash-EXL3 (pi harness)
**Started**: 2026-08-29
**Spec**: /home/piresbruno/developer/code-benchmark/specs/01-typescript-deskboard/SPEC.md
**Mode**: unattended (plan self-approved)

## Understanding of the task

DeskBoard is a full-stack meeting-room booking app: Express 5 REST API with JWT auth and two roles (admin/employee), in-memory repositories, and a React 18 + Vite UI served from the same origin. The hard parts are the business rules — conflict detection including weekly recurrence expansion, business-hours windows, cancellation windows, capacity checks, computed `completed` status — and doing them with injected `Clock`/`IdGen` so tests are deterministic. The UI needs a real design-token system, a reusable component inventory, and loading/empty/error states on every data view. Coverage gate: ≥ 75% lines on `server/src` + `shared`.

## Task breakdown

- [ ] T1 — Scaffold npm workspaces (root, server, client, shared) with tsconfigs; `npm run build` passes on empty skeleton
      Accept: BUILD_CHECK green with empty skeleton.
- [ ] T2 — `shared/`: domain types, DTOs, zod validation schemas (register/login, room, booking, password change)
      Accept: shared builds; schemas exported and used by both sides later.
- [ ] T3 — Server domain: repository interfaces + in-memory stores; auth service (register, login, password change); room service (CRUD, deactivate, duplicate-name rule)
      Accept: unit tests for auth + room rules pass with injected clock/idgen.
- [ ] T4 — Booking service: business-hours rule, overlap conflict (adjacent OK), recurrence expansion, capacity rule, cancellation window, computed completed status
      Accept: unit tests named after every §4 business rule pass.
- [ ] T5 — Usage report service + HTTP layer: express routers, JWT middleware, one shared error mapper, OpenAPI/Swagger at `/api-docs`, seed data, `app.ts`/`main.ts`, `/health`
      Accept: supertest integration tests for all endpoints incl. 401/403/404/409/422 paths pass.
- [ ] T6 — Server test hardening: full §8 server matrix (unit + integration, fresh app per test)
      Accept: `npm test` green; server coverage measured.
- [ ] T7 — Client foundation: `tokens.css` design tokens, ui/ components (Button, TextField, Select, Modal, Toast, Badge, Table, Spinner), typed fetch wrapper, auth hook
      Accept: client builds; components render with variants/error/disabled states.
- [ ] T8 — Client pages: Login, RoomGrid (with slot computation module), BookingForm, MyBookings, AdminRooms + usage report; responsive, keyboard accessible
      Accept: flows work end-to-end against running server.
- [ ] T9 — Client tests: RTL for components + unit tests for slot-computation/validation modules (≥ 8 meaningful tests)
      Accept: `npx vitest run` green in client.
- [ ] T10 — Docs: README (quickstart, env, seeded accounts, API summary), `docs/DESIGN.md`, `docs/DECISIONS.md`; .env.example
      Accept: clean-checkout quickstart ≤ 3 commands documented.
- [ ] T11 — Quality gates: build, tests 100% pass, coverage ≥ 75% (server+shared), boot & smoke (`/health`, UI at `/`), security self-review, lint clean
      Accept: all gates green; final report printed.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | JWT secret via env var `JWT_SECRET` with documented local default | Spec requires safe local defaults; secrets not in code |
| 2 | Vite dev proxy `/api` → :3000 for dev; prod build served statically by Express | Spec: UI served from same origin |
| 3 | Coverage via vitest v8 provider over server + shared workspaces | Spec §9 coverage command |
| 4 | Recurrence model: `weekly{count}` stored on booking; occurrences computed by expansion in service | Spec §4 |
| 5 | Error mapper single module mapping domain error codes → HTTP status | Spec §5 error contract |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s:
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
