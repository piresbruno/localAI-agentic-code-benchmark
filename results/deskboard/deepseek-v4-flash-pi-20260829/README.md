# DeskBoard — Meeting Room Booking

Internal meeting-room booking for a single office: employees register, book rooms (including weekly series), cancel within a 1-hour window, and view a daily room grid; admins manage rooms and read per-room usage. Ships a REST API (Express 5 + JWT) and a React 18 UI served from the same origin.

## Quickstart

```bash
npm install
npm start        # builds server+client, serves API + UI on http://localhost:3000
npm test         # unit + integration + UI tests (168 tests)
```

No database, no manual seeding, no environment file required.

## Seeded accounts & data

| Account | Credentials | Role |
|---|---|---|
| `admin@deskboard.local` | `admin123` | admin (change via `PUT /api/users/me/password`) |

Six rooms are seeded on boot (Atlas, Orion, Vega, Polaris, Andromeda, Lyra) — seeding is idempotent (only when the store is empty).

## Architecture

npm workspaces (`shared`, `server`, `client`); business rules live only in `server/src/services` (pure, with injected `Clock`/`IdGen`); `shared/` is the single source for DTO shapes + zod validation used by both sides; in-memory repositories sit behind interfaces (`server/src/repositories/`) so a DB adapter can be dropped in without touching services or routes.

```
shared/    DTOs, zod schemas, error contract, constants   (imported by both)
server/    http/* routes+middleware → services/* rules → repositories/*
client/    React 18 + Vite: design system, pages, hooks, api wrapper
```

```
client ──► /api/* ──► http middleware (JWT, zod) ──► services (rules) ──► repositories (in-memory)
```

Where a real DB would plug in: implement the repository interfaces with a Postgres/Prisma adapter and wire it in `server/src/app.ts` — nothing else changes.

## Business rules (all enforced in `server/src/services/booking-service.ts`)

- Bookings only **Mon–Fri 08:00–19:00 local**, end > start, ≤ 4 hours, start in the future.
- Same-room overlap at any occurrence → `409 ROOM_CONFLICT`; back-to-back is allowed.
- `weekly{count}` expands to `count` occurrences 7 days apart; any conflict rejects the whole series.
- Attendees > room capacity → 422. Deactivated rooms block new bookings (existing ones stand).
- Organizer cancels up to 1h before start; admin anytime; anyone else → 403.
- Past confirmed bookings read as `completed` (computed on read, never mutated).
- Room names are case-insensitively unique (409); room mutations are admin-only.

## Environment variables

| Variable | Default | Notes |
|---|---|---|
| `PORT` | `3000` | HTTP port |
| `JWT_SECRET` | `dev-secret-change-me` | **Set a strong value in production** (a warning is logged otherwise). Tokens last 12h. |

"Local time" = the server process timezone (`TZ`); all time math and business-hour checks use it.

## API

Every endpoint is documented in the interactive **Swagger UI at `/api-docs`**. Error contract on every endpoint: `{ "error": { "code", "message", "details?" } }` (400 validation, 401 unauthenticated/invalid credentials, 403 forbidden, 404 unknown, 409 conflict, 422 rule violation).

| Method | Path | Access |
|---|---|---|
| POST | `/api/auth/register` | public |
| POST | `/api/auth/login` | public |
| GET | `/api/auth/me` | auth |
| GET | `/api/rooms` | auth |
| POST / PUT / DELETE | `/api/rooms` / `/api/rooms/:id` | admin |
| GET | `/api/rooms/:id/availability?date=YYYY-MM-DD` | auth |
| POST / GET | `/api/bookings` · `/api/bookings?date=&roomId=` | auth (list scoped to self for employees) |
| GET | `/api/bookings/mine` | auth |
| DELETE | `/api/bookings/:id` | auth (owner/admin) |
| PUT | `/api/users/me/password` | auth |
| GET | `/api/admin/usage?from=&to=` | admin |
| GET | `/health` | public |

## Tests & coverage

```bash
npm run coverage   # vitest + v8: 168 tests; gate = ≥75% lines on server/src + shared/
```

- Server: service unit tests with injected clock/ids (all §4 rules by name) + supertest integration suite over the full HTTP surface.
- Client: React Testing Library (pages + design-system components) and unit tests for slot/window logic.

## Development

```bash
npm run build      # shared → server → client (tsc + vite)
npm run lint       # eslint + prettier (zero warnings)
npm run typecheck  # tsc --noEmit across all workspaces
```

## Known deviations

1. Booking start must be in the **future** (spec is silent; history is read-only by design).
2. Weekly recurrence expands into independent booking records per occurrence; `DELETE /bookings/:id` cancels one occurrence.
3. Password hashing uses Node `crypto.scrypt` (no native deps); minimum password length 8 (documented on the register form).
4. Usage report counts confirmed+completed occurrences overlapping `[from, to]`; hours = overlap minutes/60; top organizer = most occurrences (tie: lexicographic email).
5. `GET /rooms` returns inactive rooms too (client hides them from the bookable grid; admins see everything).
6. Availability book slots overlapping a booking are all marked `busy` (hourly granularity).

See `docs/DECISIONS.md` for the full decision log and `docs/DESIGN.md` for the design system.
