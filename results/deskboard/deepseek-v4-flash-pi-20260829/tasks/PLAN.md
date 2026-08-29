# PLAN — deskboard

**Agent/Model**: pi / deepseek-v4-flash
**Started**: 2026-08-29
**Spec**: /home/piresbruno/developer/code-benchmark/specs/01-typescript-deskboard/SPEC.md
**Mode**: unattended

## Understanding of the task

DeskBoard is a full-stack TypeScript meeting-room booking app (npm workspaces: `server`, `client`, `shared`). The server exposes a JWT-authenticated REST API (Express 5) with role-based authorization (admin/employee); all business rules live in a pure service layer with injected `Clock`/`IdGen`, persistence is in-memory behind repository interfaces, and `shared/` is the single source for DTO shapes + zod validation used by both sides. The React 18 + Vite client consumes the same shared types, implements the §7 design system (tokens + ui components + loading/empty/error states + a11y), and ships swappable pages: Login/Register, RoomGrid, BookingForm, MyBookings, AdminRooms with a usage report. Hard parts: the 8 named business-rule tests (business hours, conflict detection incl. weekly recurrence expansion, capacity, cancellation window, completed-on-read, admin-only room management, case-insensitive room name uniqueness), the ≥ 75% line-coverage gate on `server/src` + `shared/`, and the design-system/UX requirements (no one-off values, ≥ 4 design-system components with RTL tests, ≥ 8 meaningful client RTL tests, OpenAPI at `/api-docs`).

## Task breakdown

- [ ] T1 — Scaffold npm-workspace monorepo (root package.json + scripts, tsconfig.base.json, server/client/shared packages, vitest projects, eslint+prettier). Accept: `npm install` clean; `npm run build` green on skeleton; `npm test` passes with no tests (passWithNoTests).
- [ ] T2 — `shared/`: domain types (Role, Feature, Recurrence, Room, Booking, BookingStatus, DTOs), zod validation schemas for every request, the shared error contract `{ error: { code, message, details? } }`, business constants (hours 08:00–19:00 Mon–Fri, max 4h, durations, feature set). Accept: shared unit tests pass; BUILD_CHECK green.
- [ ] T3 — Server auth & users: scrypt password hashing, JWT issue/verify (12h expiry), auth middleware (401) + admin guard, user repo, register/login/me/password-change logic. Accept: unit tests for hashing/JWT/guards pass.
- [ ] T4 — Server repositories: in-memory `UserRepository`, `RoomRepository`, `BookingRepository` behind interfaces; `Clock` + `IdGen` injected; thread-safe reads. Accept: repo unit tests pass with fixed clock.
- [ ] T5 — Server services (ALL business rules, pure): `BookingService` (business hours, end>start, ≤4h, weekly recurrence expansion, room conflict at any occurrence, capacity, cancellation window, completed-on-read, deactivated-room blocks new bookings), `RoomService` (admin-only mutations, case-insensitive unique name, soft deactivate), `UsageService` (per-room booked hours, #bookings, top organizer). Accept: tests named for all 8 §4 rules pass.
- [ ] T6 — Server HTTP layer: routers (auth, rooms, bookings, users, admin, health), zod boundary validation → 400, shared error mapper, JWT on protected routes, seed (default rooms + admin), `app.ts` + `main.ts` (static UI from client/dist), OpenAPI 3 doc served at `/api-docs` via swagger-ui-express. Accept: supertest integration suite covers every §5 endpoint incl. 401/403/404/409/422 paths; `/health` 200.
- [ ] T7 — Client design system: `tokens.css` single source (palette, ≥4 type sizes, 4/8px spacing, radii, shadows, focus ring), `components/ui/` (Button, TextField, Select, Modal w/ focus trap+Esc+backdrop, Toast w/ aria-live, Badge, Table, Spinner/Skeleton), app scaffold styles. Accept: ≥ 4 design-system components have RTL tests (variants/disabled/error).
- [ ] T8 — Client features: typed api wrapper over shared DTOs, auth/session hook (localStorage token), data hooks with loading/empty/error states, unit-tested client logic modules (slot computation, cancel-window), pages (Login, RoomGrid, BookingForm, MyBookings, AdminRooms), routing + header w/ user menu, responsive ≥360px, keyboard-accessible. Accept: `vite build` green; ≥ 8 meaningful RTL tests + logic unit tests pass.
- [ ] T9 — Docs: README (goal, quickstart ≤3 cmds, architecture, env vars + defaults, seeded accounts, API summary + Swagger link, deviations), `docs/DECISIONS.md`, `docs/DESIGN.md`. Accept: docs committed.
- [ ] T10 — Quality gates: full test suite green, coverage ≥ 75% lines on `server/src` + `shared/` (via `npx vitest run --coverage`), build zero errors, eslint/prettier zero warnings, smoke: `npm start` → `/health` 200, `/api-docs` serves, UI at `/`. Accept: all gates green; final report written.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Booking start must be in the future (rejects past/present bookings) | Not explicitly stated; booking history is read-only (completed-on-read rule) so past bookings are meaningless — documented + tested. |
| 2 | Weekly recurrence expands to `count` independent Booking records, each carrying the recurrence def | Matches "creates count occurrences"; DELETE cancels one occurrence. No seriesId per spec silence. |
| 3 | Password hashing via Node `crypto.scrypt` (salt:hash), min password length 8 | No native deps (deterministic install); sensible default, documented in README. |
| 4 | Attendees = number of people; `attendees <= capacity` else 422 | Spec: "attendees (count ≤ room capacity)" → 422 rule violation. |
| 5 | CANCELLED bookings free the room in availability; CONFIRMED+COMPLETED occupy it | Availability reflects actual occupation; cancelled occurrences free the slot. |
| 6 | Duplicate room name overrides other edits: 409 `ROOM_NAME_TAKEN` | Spec: case-insensitive uniqueness = 409. |
| 7 | Usage report counts confirmed+completed occurrences overlapping [from,to]; hours = overlap minutes/60; top organizer = most occurrences | Reasonable interpretation of "total booked hours, #bookings, top organizer"; documented + tested. |
| 8 | Admin can cancel any non-cancelled booking at any time; organizer only ≥1h before start; others 403 | Literal reading of `enforces_cancellation_window`. |
| 9 | Server runs compiled `dist` (tsc, CommonJS-free ESM); `npm start` rebuilds deterministically | Guarantees clean-checkout `npm start` works; matches spec command table. |
| 10 | Coverage gate measured on `server/src/**` + `shared/src/**`; client coverage reported separately but excluded from the 75% gate | Matches §2/§8 ("coverage of server/src/** and shared/**; UI components excluded from the gate"). |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
