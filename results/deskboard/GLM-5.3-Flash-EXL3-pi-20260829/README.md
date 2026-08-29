# DeskBoard

Meeting-room booking app for a single office: employees book rooms for meetings, admins manage rooms and view usage. Full-stack TypeScript — Express 5 REST API with JWT auth and an in-memory store, React 18 + Vite UI served from the same origin.

## Quickstart

```bash
npm install
npm run build
npm start
```

Then open **http://localhost:3000**. The API, the UI, and Swagger UI (`/api-docs`) are all on that origin.

## Seeded accounts

| Role | Email | Password |
|---|---|---|
| Admin | `admin@deskboard.local` | `admin123` |

Employees register themselves via the UI or `POST /api/auth/register`. The seeded admin's password can be changed with `PUT /api/users/me/password`.

## Commands

| Purpose | Command |
|---|---|
| Install | `npm install` |
| Build (server + client) | `npm run build` |
| Start (API :3000 + UI same origin) | `npm start` |
| Test (server) | `npm test` |
| Test (client) | `npm run test:client` |
| Coverage (server + shared, the gate scope) | `npm run coverage` |
| Dev servers | `npm run dev:server` / `npm run dev:client` |

## Architecture

```
deskboard/
├── server/src/
│   ├── http/          # Express routers, middleware, OpenAPI — no business rules
│   ├── services/      # ALL business logic (pure; Clock & IdGen injected)
│   ├── repositories/  # in-memory store behind interfaces
│   ├── auth/          # JWT issue/verify, scrypt password hashing
│   ├── seed/          # default rooms + admin user
│   └── app.ts         # composition root; main.ts = entry point
├── shared/src/        # DTOs, domain types, zod schemas — used by BOTH sides
├── client/src/
│   ├── api/           # typed fetch wrapper over shared DTOs
│   ├── components/    # ui/ design-system components + pages
│   ├── pages/         # Login, RoomGrid, MyBookings, AdminRooms
│   ├── hooks/         # auth/session state, data fetching (loading/error/retry)
│   └── styles/        # tokens.css (design tokens) + base/component styles
└── docs/              # DESIGN.md, DECISIONS.md
```

Dependencies point inward: `http → services → repositories`. The domain never imports Express, jsonwebtoken, or React. Time (`Clock`) and ID generation (`IdGen`) are injected, so tests are fully deterministic. A real database adapter would implement the interfaces in `server/src/repositories/types.ts` and be wired in `app.ts` — nothing else changes.

## Environment variables

| Variable | Default | Purpose |
|---|---|---|
| `PORT` | `3000` | HTTP port (fail-fast on non-numeric values) |
| `JWT_SECRET` | `deskboard-dev-secret-do-not-use-in-production` | JWT signing key — **set explicitly in production** |
| `CLIENT_DIST_DIR` | `../client/dist` | Where the built UI is served from |
| `SEED_ROOMS` | built-in defaults | Reserved for custom seed data |

## API summary

All endpoints under `/api`; full interactive docs at **`/api-docs`** (OpenAPI 3 served by Swagger UI). Errors use one envelope: `{ "error": { "code", "message", "details?" } }`.

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`
- `GET /api/rooms` (auth required) · `POST/PUT/DELETE /api/rooms/:id` (admin only; DELETE = soft-deactivate)
- `GET /api/rooms/:id/availability?date=YYYY-MM-DD`
- `POST /api/bookings`, `GET /api/bookings/mine`, `GET /api/bookings?date=&roomId=`, `DELETE /api/bookings/:id` (cancel)
- `PUT /api/users/me/password`
- `GET /api/admin/usage?from=&to=`
- `GET /health`

Business rules enforced in the booking service: business hours (Mon–Fri 08:00–19:00 local, ≤ 4h), overlap conflicts (409 `ROOM_CONFLICT`, adjacent OK), weekly recurrence (conflict in any occurrence rejects the series), capacity, cancellation window (organizer ≥ 1h before start, admin anytime), computed `completed` status (history is never mutated on read).

## Documentation

- [`docs/DESIGN.md`](docs/DESIGN.md) — design system: tokens, components, usage guidance
- [`docs/DECISIONS.md`](docs/DECISIONS.md) — non-obvious decisions & spec deviations

## Known deviations

See `docs/DECISIONS.md` — the short version: `weekly{count}` recurrence stores only the series spec (occurrences are computed), and top-organizer in the usage report is ranked by booked minutes.
