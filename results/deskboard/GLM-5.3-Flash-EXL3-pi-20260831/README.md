# DeskBoard

Internal meeting-room booking app for a single office: employees book rooms, admins manage them.
Express 5 REST API + React 18 SPA, JWT auth with employee/admin roles, in-memory persistence.

## Quickstart (from a clean checkout)

```bash
npm install
npm start        # builds all workspaces, then serves API + UI on http://localhost:3000
```

Open http://localhost:3000 and sign in with the seeded admin:

| Account | Email | Password |
|---|---|---|
| Admin | `admin@deskboard.local` | `admin123` |

Or register a new employee account from the UI (self-service, employee role).

## Commands

| Purpose | Command |
|---|---|
| Install | `npm install` |
| Build (server + client) | `npm run build` |
| Start (API :3000 + UI same origin) | `npm start` |
| Tests | `npm test` |
| Coverage (server/src + shared/src) | `npm run coverage` |
| Lint | `npm run lint` |

Coverage gate: ≥ 75 % lines on `server/src/**` + `shared/src/**` — current run: **98.9 %**.

## Architecture

```
deskboard/
├── server/src/
│   ├── http/          Express routers + middleware ONLY (no business rules)
│   │   └── openapi.ts OpenAPI 3 document served at /api-docs (Swagger UI)
│   ├── services/      ALL business rules; Clock/IdGen injected, no framework imports
│   ├── repositories/  In-memory store behind interfaces (swap-in point for a real DB)
│   ├── auth/          JWT issue/verify (12h expiry), scrypt password hashing
│   ├── seed/          Default rooms + admin account, idempotent on boot
│   └── app.ts, main.ts
├── shared/src/        DTO types, zod schemas, error codes — single source for BOTH sides
└── client/src/
    ├── api/           Typed fetch wrapper over shared DTOs + error contract
    ├── components/    ui/ design-system components + shared States (loading/empty/error)
    ├── pages/         RoomGrid, BookingForm, MyBookings, AdminRooms, Login
    ├── hooks/         useAuth (session), useResource (loading/empty/error data hook)
    ├── lib/           slots.ts (grid build, cancel window) + validate.ts — unit-tested
    └── styles/        tokens.css (design tokens) + app.css (tokenized components)
```

Dependencies point inward: `http → services → repositories`. The domain never imports express,
jsonwebtoken, or React. Time and id generation are injected (`Clock`, `IdGen`), which is what makes
the business rules unit-testable with fixed dates.

### Swapping the persistence layer

`server/src/repositories/types.ts` defines `UserRepository`, `RoomRepository`, `BookingRepository`.
`memory.ts` is the in-memory implementation used by `app.ts`. A real database ships as another
implementation of the same interfaces (e.g. `PgBookingRepository`) and is wired in `createApp()` —
no service or route code changes.

## API summary

Every endpoint is documented with Swagger UI at **http://localhost:3000/api-docs**.

| Endpoint | Notes |
|---|---|
| `POST /api/auth/register`, `POST /api/auth/login` | → JWT (12 h) |
| `GET /api/auth/me` | current user |
| `GET /api/rooms` | any authenticated user |
| `POST /api/rooms`, `PUT /api/rooms/:id`, `DELETE /api/rooms/:id` | admin only (soft-deactivate) |
| `GET /api/rooms/:id/availability?date=YYYY-MM-DD` | free/busy grid 08:00–19:00 |
| `POST /api/bookings`, `GET /api/bookings/mine`, `DELETE /api/bookings/:id` | cancel window rules |
| `GET /api/health` | also reachable as `/health` |

Errors always follow `{ error: { code, message, details? } }` — 400 validation, 401 auth,
403 forbidden, 404 unknown, 409 conflict, 422 business rule.

## Environment variables

| Var | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | `dev-only-secret-change-me` | JWT signing; **must** be set outside local dev (server refuses to boot with the default in production) |
| `NODE_ENV` | `development` | `production` enables the JWT_SECRET boot check |
| `CLIENT_DIST` | `client/dist` | SPA directory served by the API |

See `.env.example`.

## Business rules (each covered by a test named for it)

- Bookings run Mon–Fri 08:00–19:00 local, end after start, ≤ 4 h (`rejects_booking_outside_business_hours`)
- Overlapping bookings on a room → 409 `ROOM_CONFLICT`; back-to-back allowed (`rejects_booking_when_room_already_booked`)
- Attendees ≤ room capacity → else 422 `OVER_CAPACITY` (`rejects_booking_over_capacity`)
- Deactivated rooms reject new bookings; existing bookings/cancellations unaffected (`rejects_bookings_for_inactive_rooms`)
- Organizer cancels up to 1 h before start; admin anytime; others 403 (`enforces_cancellation_window`)
- Past bookings display as `completed` — computed on read, history never mutated (`marks_completed_bookings`)
- Room names unique case-insensitive → 409 `ROOM_NAME_TAKEN` (`rejects_duplicate_room_name`)

## Testing

```bash
npm test          # all 109 tests: server units + supertest integration + RTL client tests
npm run coverage  # v8 coverage scoped to server/src + shared/src
```

- Server: service units with injected `Clock`/`IdGen`; HTTP integration with supertest, fresh app per test.
- Client: React Testing Library component tests (variants, error slots, modal a11y, toasts);
  unit tests for the grid/cancel-window/validate logic modules.

## Known deviations

- **LOC above the 1,000 target** (server 1,068 + shared 150 + client 1,391 ≈ 2,609): every §5/§6/§7
  feature is implemented; the overage sits in the mandated OpenAPI document (235 lines covering all
  10 endpoints) and the required component inventory with its state matrix. We chose complete
  features over the cap.
- Naive local ISO-8601 (`YYYY-MM-DDTHH:mm`) as the wire format — see `docs/DECISIONS.md`.
- Non-decision details and all other deviations are listed in `docs/DECISIONS.md`.

## Design system

`docs/DESIGN.md` documents tokens, components, and usage guidance. `docs/DECISIONS.md` records
non-obvious implementation decisions.
