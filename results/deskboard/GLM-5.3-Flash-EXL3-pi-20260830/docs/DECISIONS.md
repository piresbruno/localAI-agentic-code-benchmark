# Decisions

One line per non-obvious decision.

- **Auth**: JWT (HS256, 12h expiry) issued by `server/src/auth/jwt.ts`; secret from `JWT_SECRET` env with a documented dev default; token sent as `Authorization: Bearer`.
- **Password hashing**: Node built-in `crypto.scrypt` with per-user salt + timing-safe compare (`server/src/auth/password.ts`) — avoids a native bcrypt dependency while keeping the same security shape.
- **Authorization layering**: routes enforce authentication/role (`requireAuth`, `requireAdmin`), but business-level authorization (organizer vs admin on cancel, admin-only room ops) lives in the services so it cannot be bypassed by route changes.
- **Error model**: single `AppError` (code → HTTP status map) in `shared/src/errors.ts`; one error mapper in `http/middleware/errors.ts` turns AppError/ZodError/unknown into `{ error: { code, message, details? } }`; unknown errors are logged server-side and returned as opaque 500s.
- **Validation**: shared zod schemas in `shared/src/schemas.ts` used by the server at every boundary and by the client for inline form validation — one source, no duplication.
- **Recurrence model**: `weekly{count}` is expanded into one stored occurrence per week at creation time; occurrences share `groupId`; conflict in any occurrence rejects the whole booking (all-or-nothing). Simpler conflict checks and per-occurrence cancellation; the spec leaves the storage model open.
- **`completed` status**: never persisted; computed on read (`BookingService.toDto`) so history is never mutated.
- **Cancellation window**: organizer ≥ 1h before start else 422 `RULE_VIOLATION`; admin anytime; other employees 403. Cancelling an already-cancelled booking → 409 `BOOKING_ALREADY_CANCELLED` (spec named the window but not this edge; 409 chosen as the conflict-family status).
- **Room DELETE**: soft-deactivate (`active=false`) per spec; deactivated rooms reject new bookings with 422 but existing bookings are untouched.
- **Availability grid**: server-computed free/busy per room per date (`GET /rooms/:id/availability`), because employees must see others' bookings there while `GET /bookings` is role-scoped (employee = own only).
- **Usage report**: sums confirmed (non-cancelled) bookings whose start falls within the inclusive date range; top organizer ranked by booked hours.
- **Password change**: requires the current password (403 on mismatch) — the spec lists the endpoint but not the safeguard; requiring it prevents session-hijack password takeover.
- **SPA serving**: `express.static(client/dist)` + a GET fallback to `index.html` (skips `/api`, `/api-docs`, `/openapi.json`); the API has no runtime dependency on the client build (UI absent → API still boots).
- **OpenAPI**: declarative `openapi.json` served at `/openapi.json` with Swagger UI (CDN) at `/api-docs`; file excluded from the coverage gate.
- **Client routing**: tiny hash router (`useHashRoute`) instead of react-router — the app has 4 routes and no deep-link requirements beyond hash params.
- **Timezone handling**: bookings use local ISO strings with minutes precision; same-format strings compare correctly with plain string ordering, and tests build dates with local `Date` arithmetic so they are timezone-independent.
