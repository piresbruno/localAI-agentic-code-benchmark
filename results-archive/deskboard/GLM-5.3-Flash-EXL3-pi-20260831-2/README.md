# DeskBoard — Meeting Room Booking App

DeskBoard is an internal meeting-room booking app for a single office: employees book
rooms for meetings, admins manage rooms. It ships a **REST API** (Express 5, JWT auth,
in-memory persistence) and a **browser UI** (React 18 + Vite) served from the same
origin, sharing DTO types and validation schemas from one `shared` package.

## Quickstart (clean checkout)

```bash
npm install
npm start          # builds shared/server/client, then serves API + UI on :3000
```

Open http://localhost:3000 — `GET /health` returns `200`.

| Command            | Purpose                                                                    |
| ------------------ | -------------------------------------------------------------------------- |
| `npm start`        | Build all workspaces + boot API and UI on one port                         |
| `npm test`         | Run the full test suite (server + client)                                  |
| `npm run coverage` | Test suite with v8 coverage (gate: ≥ 75% lines on `server/src` + `shared`) |
| `npm run build`    | Compile shared → server → client                                           |
| `npm run lint`     | ESLint + Prettier check (zero warnings policy)                             |

## Seeded accounts

| Role  | Email                   | Password   |
| ----- | ----------------------- | ---------- |
| Admin | `admin@deskboard.local` | `admin123` |

New accounts created through the UI/API are `employee` role.

## Environment variables

| Variable     | Default                     | Notes                                              |
| ------------ | --------------------------- | -------------------------------------------------- |
| `PORT`       | `3000`                      | API + UI port                                      |
| `JWT_SECRET` | `dev-only-secret-change-me` | **Required in production** (boot fails without it) |
| `NODE_ENV`   | `development`               | `production` enables fail-fast config checks       |

See `.env.example`.

## Architecture

```
deskboard/
├── server/src/
│   ├── http/        Express routers, middleware, error mapper, OpenAPI (boundary only)
│   ├── services/    ALL business rules (BookingService, RoomService, AuthService)
│   ├── repositories/ In-memory stores behind interfaces
│   ├── auth/        JWT issue/verify + scrypt password hashing (injectable ports)
│   ├── seed/        Default admin + rooms
│   └── app.ts / main.ts / config.ts
├── shared/src/      DTO types, zod schemas, error codes (single source, used by BOTH sides)
├── client/src/
│   ├── api/         Typed fetch wrapper over shared DTOs
│   ├── components/ui/  Design-system kit (Button, TextField, Select, Modal, Toast, Table, Spinner)
│   ├── pages/       RoomGrid, BookingForm, MyBookings, AdminRooms, Login (+ DataView states)
│   ├── hooks/       Auth session state, async data fetching
│   ├── lib/         Pure UI logic (slot grid, cancellation window mirror)
│   └── styles/      tokens.css (single source) + component/app styles
└── docs/            DESIGN.md (design system) · DECISIONS.md (decision log)
```

Key rules enforced by the code layout:

- Business rules live **only** in `server/src/services`. The domain never imports
  express/jsonwebtoken/React; time (`Clock`) and ids (`IdGen`) are injected, so tests
  pass fixed values.
- `shared/` is the single source for DTO shapes and zod validation — the client and
  server do not duplicate them.
- One error model: `{ error: { code, message, details? } }` mapped by a single
  middleware (`http/errorMapper.ts`): 400 validation · 401 unauthenticated ·
  403 forbidden · 404 unknown · 409 conflict · 422 rule violation.

### Persistence

Repositories are in-memory Maps behind the interfaces in `server/src/repositories/types.ts`.
A real database adapter would implement those same interfaces (e.g. `PgBookingRepository`)
and be substituted in `createApp` (`server/src/app.ts`) — no service or HTTP code changes.

## API

Interactive docs: **http://localhost:3000/api-docs** (Swagger UI, OpenAPI 3.0).

| Method & path                                     | Auth  | Description                                 |
| ------------------------------------------------- | ----- | ------------------------------------------- |
| `GET /health` · `GET /api/health`                 | —     | Liveness                                    |
| `POST /api/auth/register`                         | —     | Create employee account → JWT (12h)         |
| `POST /api/auth/login`                            | —     | Email + password → JWT (12h)                |
| `GET /api/auth/me`                                | user  | Current profile                             |
| `GET /api/rooms`                                  | user  | All rooms (incl. deactivated, flagged)      |
| `POST /api/rooms`                                 | admin | Create room (unique name, case-insensitive) |
| `PUT /api/rooms/:id`                              | admin | Update room                                 |
| `DELETE /api/rooms/:id`                           | admin | Soft-deactivate (stops new bookings)        |
| `GET /api/rooms/:id/availability?date=YYYY-MM-DD` | user  | Free/busy grid, hourly 08:00–19:00          |
| `POST /api/bookings`                              | user  | Create booking (rules below)                |
| `GET /api/bookings/mine`                          | user  | Own bookings, computed status               |
| `DELETE /api/bookings/:id`                        | user  | Cancel (window rules below)                 |

Business rules (each covered by a test named for it):

- Mon–Fri 08:00–19:00 local, end > start, ≤ 4h duration → otherwise 422
- Overlapping booking on the same room → 409 `ROOM_CONFLICT` (back-to-back allowed)
- Attendees above room capacity → 422
- Deactivated rooms reject new bookings → 409 (existing bookings/cancellations unaffected)
- Cancel: organizer up to 1h before start (inclusive), admin anytime, others → 403
- Bookings whose end has passed are shown `completed` — computed on read, never mutated
- Duplicate room name (case-insensitive) → 409

## Testing

- `server/tests/` — unit tests for services with injected fixed `Clock`/`IdGen`, plus
  supertest integration tests against a fresh app per test (auth paths, validation,
  error contract, every business rule).
- `client/tests/` — React Testing Library component tests, page-level flow tests, and
  unit tests for the pure slot/cancellation logic in `client/src/lib/slots.ts`.
- Coverage gate: `npm run coverage` enforces ≥ 75% lines on `server/src/**` + `shared/src/**`
  (currently **97.4%**).

## UI

Design tokens live in `client/src/styles/tokens.css` (single source — no hardcoded
colors/sizes outside it). Component reference and usage guidance: [`docs/DESIGN.md`](docs/DESIGN.md).
Every data view implements loading / empty / error states; toasts and inline validation
surface the API's error contract; keyboard operable with visible focus rings (WCAG AA).

## Known deviations

- The spec targets 600–1,000 production TypeScript lines (hard cap); this implementation
  is intentionally larger because the required feature set (OpenAPI for every endpoint,
  the §7 component inventory, five pages with full UX states) does not fit the cap.
  Details in [`docs/DECISIONS.md`](docs/DECISIONS.md) — no feature was cut.
