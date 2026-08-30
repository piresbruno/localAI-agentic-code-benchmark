# DeskBoard

Meeting-room booking app for a single office: employees book rooms for meetings, admins manage rooms and view usage. REST API + browser UI served from the same origin.

**Stack**: TypeScript · Node 20+ · Express 5 · JWT · in-memory persistence · React 18 + Vite.

## Quickstart

```bash
npm install
npm run build
npm start
```

Then open http://localhost:3000 — the API, the UI and the docs all live there.

| URL | What |
|---|---|
| `/` | The DeskBoard UI |
| `/api/health` | Health check |
| `/api-docs` | Swagger UI for the whole API |

## Seeded accounts & data

| Account | Email | Password |
|---|---|---|
| Admin | `admin@deskboard.local` | `admin123` |

Registering from the UI creates `employee` accounts. Three rooms are seeded (Kiwi, Falcon, Cedar) with different capacities and features. The admin password can (and should, locally) be changed via `PUT /api/users/me/password` or the app.

## Env vars (all optional, safe local defaults)

| Var | Default | Notes |
|---|---|---|
| `PORT` | `3000` | API + UI port |
| `JWT_SECRET` | `dev-only-secret-change-me` | Set a real secret outside local dev |

## Architecture

```
├── server/src/
│   ├── http/          # Express routers + middleware ONLY (no business rules)
│   ├── services/      # ALL business logic (pure; Clock & IdGen injected)
│   ├── repositories/  # in-memory store behind interfaces
│   ├── auth/          # JWT issue/verify, scrypt password hashing
│   ├── seed/          # default rooms + admin user
│   └── app.ts         # composition root / main.ts entrypoint
├── shared/src/        # DTOs, domain types, zod schemas, error contract (used by BOTH sides)
└── client/src/
    ├── api/           # typed fetch wrapper over shared DTOs
    ├── components/    # design system (ui/) + page states
    ├── pages/         # Login, RoomGrid, BookingForm, MyBookings, AdminRooms
    ├── hooks/         # auth session, data fetching, hash router
    └── logic/         # slot math, form validation (unit tested)
```

Rules enforced by the codebase: business rules live **only** in `server/src/services`; the domain never imports `express`, `jsonwebtoken` or React; time and ID generation are injected (`Clock`, `IdGen`); `shared/` is the single source of DTO shapes and validation (zod) — client and server never duplicate them.

### Persistence

Storage is in-memory behind the interfaces in `server/src/repositories/types.ts` (`UserRepository`, `RoomRepository`, `BookingRepository`). A real database adapter implements those three interfaces and is passed to `createApp()` in `server/src/app.ts` — no other file changes.

## Business rules (spec §4, each has a named test)

- Bookings only Mon–Fri 08:00–19:00 local, end > start, ≤ 4h — `rejects_booking_outside_business_hours`
- Overlap on a room = 409 `ROOM_CONFLICT`; back-to-back allowed — `rejects_booking_when_room_already_booked`
- `weekly{count}` creates N occurrences 7 days apart; any conflict rejects the whole booking — `expands_weekly_recurrence`
- Attendees above room capacity = 422 — `rejects_booking_over_capacity`
- Organizer may cancel up to 1h before start; admin anytime; others never (403) — `enforces_cancellation_window`
- Bookings whose end passed display as `completed` (computed on read, never mutated) — `marks_completed_bookings`
- Room create/update/deactivate = admin only; deactivation blocks new bookings, not existing ones — `admins_manage_rooms_only`
- Room names are unique case-insensitively (409) — `rejects_duplicate_room_name`

## Tests & coverage

```bash
npm test             # 114 tests: services, repos, HTTP integration (supertest), RTL components
npm run coverage     # v8 coverage scoped to server/src + shared/src
npx eslint .         # lint, zero warnings
```

Current coverage: **96% lines** on `server/src + shared/src` (gate: ≥ 75%).

## Docs

- [`docs/DESIGN.md`](docs/DESIGN.md) — design system: tokens, components, when to use which variant.
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — one line per non-obvious decision.

## Known deviations from the spec

See `docs/DECISIONS.md` — the short version: weekly recurrences are expanded into one booking record per occurrence at creation time (all-or-nothing), `DELETE /rooms/:id` soft-deactivates, and password hashing uses Node's built-in scrypt instead of a native bcrypt dependency.
