# DeskBoard — Meeting Room Booking App

**Version**: 1.0.0
**Stack**: TypeScript, Node 20+, Express 5, JWT, in-memory persistence; React 18 + Vite frontend
**Audience**: AI coding agents evaluated on building a full-stack TypeScript app end-to-end.

---

## 1. Overview & Goals

Build **DeskBoard**, an internal meeting-room booking app for a single office: employees book rooms for meetings, admins manage rooms and view usage. It ships a **REST API** and a **browser UI** backed by the same API.

**Why this exists.** This project grades an agent's ability to:
- Translate a written spec into a working full-stack TypeScript app (server + client).
- Implement JWT auth with role-based authorization (employee/admin).
- Express business rules (conflict detection, business hours, recurrence, cancellation windows).
- Build a usable, responsive UI on top of the API.
- Produce docs and tests meeting a coverage gate.

**LOC expectation.** ~2,000–3,000 lines of TypeScript (server + client + shared). Significantly less usually means features are missing; significantly more usually means over-engineering.

## 2. Success criterion (pass/fail)

ALL of the following must be true:

1. **Sandboxed** — no dependencies on anything outside the run directory.
2. **Ready to run** — from a clean checkout: `npm install`, then `npm start` boots the API, seeds default data, and serves the UI. `GET /health` → 200. No manual DB, no hand-seeding. Env vars have safe local defaults (documented in README).
3. **UI works** — a user can register/login, view the room grid for a day, create a booking via the form, see conflicts rejected, cancel a booking, and admins can add/edit rooms. (Verified manually by the grader via SMOKE_CHECK + clicking through.)
4. **Design system conformance** — tokens + shared UI components exist per §7, and every data view implements loading/empty/error states. Spot-checked manually; scored in the rubric's UI/UX category.
5. **OpenAPI** — `GET /api-docs` serves Swagger UI describing every endpoint in §5.
6. **All tests pass**, and **line coverage ≥ 75%** of `server/src/**` and `shared/**` (UI components excluded from the gate but need at least 8 meaningful React Testing Library tests).

## 3. Architecture (REQUIRED — deviations = fail)

```
deskboard/
├── package.json            # workspaces: server, client, shared
├── server/
│   └── src/
│       ├── http/           # Express routers, middleware ONLY (no business rules)
│       ├── services/       # ALL business logic (pure; clock & ids injected)
│       ├── repositories/   # in-memory store behind interfaces
│       ├── auth/           # JWT issue/verify, password hashing
│       ├── seed/           # default rooms + admin user
│       └── app.ts / main.ts
├── shared/                 # DTOs, domain types, validation schemas used by BOTH sides
│   └── src/
├── client/
│   └── src/
│       ├── api/            # typed fetch wrapper over shared DTOs
│       ├── components/     # presentational React components
│       ├── pages/          # RoomGrid, BookingForm, MyBookings, AdminRooms, Login
│       ├── hooks/          # auth/session state, data fetching
│       └── main.tsx
└── README.md
```

Rules:
- Business rules live **only** in `server/src/services`. `http/` maps requests ↔ services.
- The domain never imports `express`, `jsonwebtoken`, or React. Time and ID generation are **injected** (e.g., `Clock`, `IdGen` interfaces) — tests pass fixed values.
- `shared/` is the single source for DTO shapes and validation logic (zod schemas recommended); client and server must not duplicate them.
- In-memory persistence behind repository **interfaces**; a README note explains where a real DB adapter would plug in.

## 4. Domain model

**Roles**: `admin`, `employee`. Anyone can register as `employee` (name, email, password). Seeded admin: `admin@deskboard.local` / `admin123` (must be changeable via `PUT /api/users/me/password`).

**Room**: `id`, `name` (unique, case-insensitive), `capacity` (1–100), `floor` (1–30), `features` ⊆ {`screen`, `whiteboard`, `videoconf`, `phone`}, `active`.

**Booking**: `id`, `roomId`, `title` (1–100 chars), `organizerId`, `start`/`end` (ISO-8601, minutes precision), `recurrence` (`none` | `weekly{count}`), `status` (`confirmed` | `cancelled` | `completed`), `attendees` (count ≤ room capacity), `createdAt`.

**Business rules (each needs a test named for it):**
- `rejects_booking_outside_business_hours` — bookings only Mon–Fri 08:00–19:00 local; end > start; ≤ 4h duration.
- `rejects_booking_when_room_already_booked` — overlap on same room at any occurrence = 409 `ROOM_CONFLICT` (adjacent bookings back-to-back allowed).
- `expands_weekly_recurrence` — `weekly{count}` creates `count` occurrences 7 days apart; conflict in ANY occurrence rejects the whole booking.
- `rejects_booking_over_capacity` — attendees > room capacity = 422.
- `enforces_cancellation_window` — organizer may cancel up to 1h before start; admin anytime; others never (403).
- `marks_completed_bookings` — on read, bookings whose end passed are shown as `completed` (never mutate history on read; compute status).
- `admins_manage_rooms_only` — create/update/deactivate rooms = admin only; deactivate blocks new bookings, not existing ones.
- `rejects_duplicate_room_name` — case-insensitive uniqueness = 409.

## 5. API surface (all `/api` prefixed)

- `POST /auth/register`, `POST /auth/login` → JWT (12h expiry), `GET /auth/me`
- `GET /rooms` (public within app: auth required), `POST /rooms`, `PUT /rooms/:id`, `DELETE /rooms/:id` (soft-deactivate) — admin only for mutations
- `GET /rooms/:id/availability?date=YYYY-MM-DD` → free/busy grid
- `POST /bookings`, `GET /bookings/mine`, `GET /bookings?date=&roomId=` (admin: all; employee: own), `DELETE /bookings/:id` (cancel)
- `PUT /users/me/password`
- `GET /admin/usage?from=&to=` — per-room: total booked hours, #bookings, top organizer (admin only)
- `GET /health`
- Errors: `{ error: { code, message, details? } }` — 400 validation, 401 unauthenticated, 403 forbidden, 404 unknown, 409 conflict, 422 rule violation. One shared error mapper.

## 6. UI requirements (React + Vite)

- **Login/Register page** — token stored in memory/localStorage, attached to API calls; logout.
- **RoomGrid (home)** — pick a date (default today); grid of rooms × hourly slots 08:00–19:00 showing bookings; click empty slot → prefilled booking form.
- **BookingForm** — room (locked when prefilled), title, date, start time, duration (30/60/90/120 min), attendees, recurrence (none/weekly ×N). Inline validation errors from the API error contract.
- **MyBookings** — list own upcoming/past bookings; cancel button (respecting window; disabled + tooltip otherwise).
- **AdminRooms** — table of rooms; add/edit modal; deactivate; usage report table (from `/admin/usage`).
- Styling: plain CSS (or CSS modules) on top of the design system in §7, responsive ≥ 360px, visible focus states. No component libraries.
- UI logic that embeds business rules (e.g., computing free slots) should live in `client/src` modules that are unit-tested; components stay presentational.

## 7. Design system & UX quality (REQUIRED — scored, not optional polish)

The grader evaluates UI/UX and design-system quality explicitly (rubric category). The following are required, not nice-to-have:

### 7.1 Design tokens
- `client/src/styles/tokens.css` (or an equivalent `design/tokens.ts`) is the **single source** for: color palette (primary, neutrals, semantic success/warning/danger), typography scale (≥ 4 sizes with consistent line-heights), spacing scale (4/8px grid), border radii, shadow levels.
- **No one-off values**: hardcoded hex colors, font sizes, or off-scale spacing outside tokens is a rubric deduction. Graders grep for it.

### 7.2 Component inventory (in `client/src/components/ui/`, reused everywhere)
| Component | Required states/props |
|---|---|
| `Button` | variants `primary`/`secondary`/`danger`, `loading` (spinner + disabled), disabled |
| `TextField` / `Select` | label (visible, tied via `htmlFor`), error message slot, disabled |
| `Modal` | open/close, focus trap, Esc to close, backdrop click |
| `Toast` | success/error, auto-dismiss, `aria-live` region |
| `Badge`/`Tag` | booking status, room features |
| `Table` | header, zebra/hover rows, empty-state row |
| `Spinner`/`Skeleton` | used by loading states |

Every component implements hover, focus-visible, and disabled states. At least 4 of these components have RTL tests (variants render, error state shows).

### 7.3 UX states — every data view (RoomGrid, MyBookings, AdminRooms, usage report) implements all three:
- **Loading**: skeleton or spinner, never an unstyled blank flash.
- **Empty**: human message + call to action ("No bookings yet — pick a room").
- **Error**: friendly message + retry action; never a raw stack/JSON.

### 7.4 Interaction feedback
- Submit buttons show pending state and are **double-submit safe** (disabled while in flight).
- Success/failure feedback via toast (or inline), including the API's error message text from the error contract.
- Optimistic update is allowed but must reconcile on failure.

### 7.5 Accessibility (WCAG AA basics)
- All interactive elements reachable and operable by **keyboard**; logical tab order through the booking form and modals; focus visible (focus ring token).
- Color contrast ≥ 4.5:1 for body text; status is never conveyed by color alone (pair with icon/text).
- Form inputs have real labels; modals set `role="dialog"` + `aria-modal`; toasts use `aria-live`.

### 7.6 Layout & visual consistency
- Consistent page scaffold (header with app name + user menu, container width, section rhythm from the spacing scale).
- Room grid and tables align to the grid; type hierarchy obvious (page title vs. section vs. body).
- `docs/DESIGN.md`: one page describing tokens, components, and when to use which variant — the design system's README.

### 7.7 How it's verified
Grader loads the UI, walks the flows, toggles loading/empty/error (e.g., stopping the API), tries keyboard-only operation, checks contrast on primary text, greps for off-token values, and scores against the rubric's UI/UX & Design System category.

## 8. Testing requirements

- **Server**: unit-test services with injected `Clock`/`IdGen`; integration-test HTTP layer with `supertest` (fresh app instance per test). Cover every §4 rule + auth paths (401/403) + validation (400/422).
- **Client**: React Testing Library for components (render, fill form, submit, assert call + error display); unit tests for slot-computation and validation modules; ≥ 4 tests on the §7 design-system components (variants, disabled, error state).
- **Coverage**: `npx vitest run --coverage` — the gates are those in §2 (coverage gate = §2 item 6). Coverage-gaming (assert-true tests) is a rubric violation.

## 9. Commands

| Purpose | Command |
|---|---|
| Install | `npm install` |
| Build | `npm run build` (server + client) |
| Start | `npm start` (API on :3000, UI served from same origin) |
| Test | `npm test` |
| Coverage | `npm run coverage` |

## 10. Documentation

README: goal, quickstart (≤ 3 cmds), architecture overview, env vars + defaults, seeded accounts, API summary (link Swagger), known deviations. `docs/DECISIONS.md`: one line per non-obvious decision (auth approach, error mapping, recurrence model).
