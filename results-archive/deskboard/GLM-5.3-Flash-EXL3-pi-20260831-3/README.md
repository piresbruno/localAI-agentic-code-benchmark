# DeskBoard

Meeting-room booking for a single office: employees book rooms for meetings, admins manage rooms. Full-stack TypeScript — an Express 5 REST API and a React 18 SPA served from the same origin, backed by in-memory repositories behind interfaces.

## Quickstart

```bash
npm install
npm run build
npm start
```

Then open **http://localhost:3000**. `GET /health` returns `200`.

## Seeded accounts

| Account | Email | Password | Role |
|---|---|---|---|
| Office Admin | `admin@deskboard.local` | `admin123` | admin |
| — | register via the UI | — | employee (self-service) |

Seeding runs automatically on first boot (idempotent): 1 admin + 5 starter rooms.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | API + UI port |
| `JWT_SECRET` | `dev-only-secret-change-me` | JWT signing secret. **Must be set in production** (boot fails otherwise). |

See `.env.example`.

## Architecture

```
deskboard/
├── shared/src/        # DTOs, domain types, zod schemas — single source for both sides
├── server/src/
│   ├── http/          # Express routers, middleware, OpenAPI/Swagger — no business rules
│   ├── services/      # ALL business logic (pure; Clock & IdGen injected)
│   ├── repositories/  # in-memory store behind interfaces
│   ├── auth/          # JWT issue/verify, scrypt password hashing
│   ├── seed/          # default rooms + admin user
│   ├── app.ts         # composition root (repos → services → HTTP)
│   └── main.ts        # config + boot
└── client/src/
    ├── api/           # typed fetch wrapper over shared DTOs
    ├── components/    # presentational components + ui/ design system
    ├── pages/         # Login, RoomGrid, BookingForm, MyBookings, AdminRooms
    ├── hooks/         # auth/session state, data fetching (loading/error/retry)
    └── lib/           # unit-tested client booking logic (slots, cancellation window)
```

Rules: business rules live only in `services/`; the domain never imports `express`, `jsonwebtoken`, or React; time and ID generation are injected (`Clock`, `IdGen`); both sides validate with the same zod schemas from `shared/`.

**Where a real database would plug in:** every service depends on the repository *interfaces* in `server/src/repositories/*Repository.ts` (e.g. `RoomRepository`, `BookingRepository`). A SQL/ORM adapter implements those interfaces and is wired in `app.ts`/`main.ts` instead of the `Memory*` classes — no service or HTTP code changes. For a serverless DB, `Clock` stays as-is and the adapter maps its own transactions.

## API summary

All endpoints are under `/api` and documented in OpenAPI 3 — Swagger UI at **`GET /api-docs`** (raw spec at `/api-docs.json`).

| Method & path | Auth | Purpose |
|---|---|---|
| `GET /health` | — | liveness |
| `POST /auth/register` | — | self-registration (employee) |
| `POST /auth/login` | — | returns JWT (12h) + user |
| `GET /auth/me` | bearer | current profile |
| `GET /rooms` | bearer | list rooms |
| `POST /rooms` | admin | create room |
| `PUT /rooms/:id` | admin | update room |
| `DELETE /rooms/:id` | admin | soft-deactivate room |
| `GET /rooms/:id/availability?date=` | bearer | free/busy grid, hourly 08:00–19:00 |
| `POST /bookings` | bearer | create booking (rules below) |
| `GET /bookings/mine` | bearer | own bookings, computed status |
| `DELETE /bookings/:id` | bearer | cancel (window rules below) |

Errors always use `{ "error": { "code", "message", "details?" } }` — 400 validation, 401 unauthenticated, 403 forbidden, 404 unknown, 409 conflict, 422 rule violation.

**Business rules** (each covered by a test named for it): bookings only Mon–Fri 08:00–19:00 local, end > start, ≤ 4h; overlapping bookings on a room → 409 `ROOM_CONFLICT` (back-to-back allowed); attendees ≤ room capacity (422); deactivated rooms reject new bookings but keep history; organizer may cancel up to 1h before start, admin anytime, others never; bookings whose end has passed read as `completed` without mutating stored history; room names unique case-insensitively.

## Testing & coverage

```bash
npm test            # all server + client tests
npm run coverage    # vitest coverage; gate: ≥75% lines on server/src + shared
```

Server tests are unit tests on services with a fixed `Clock`/`IdGen` plus supertest integration tests (fresh app per test). Client tests are React Testing Library component tests plus unit tests for the slot/cancellation logic in `client/src/lib`.

## Design system

`client/src/styles/tokens.css` is the single source for color, typography, spacing, radii, and shadows — no off-token values elsewhere. Component inventory (`client/src/components/ui/`): Button, TextField, Select, Modal, Toast, Table, Spinner — all with hover/focus-visible/disabled states. See `docs/DESIGN.md` for the reference and `docs/DECISIONS.md` for the reasoning behind non-obvious choices.

## Known deviations

See `docs/DECISIONS.md` — notably: emails and room-name lookups normalize case in the service/repository layer; the cancellation window is inclusive at exactly 1h; `server/src/main.ts` (listen bootstrap) is excluded from the coverage scope.
