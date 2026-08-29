# DeskBoard — Decisions & Deviations

One line per non-obvious decision.

- **JWT with 12h expiry; secret via `JWT_SECRET` env var.** Local default exists for zero-config dev but is documented as dev-only in README.
- **Password hashing: node:crypto scrypt** (`scrypt:salt:hash` format) instead of bcrypt — no native build deps, constant-time compare via `timingSafeEqual`.
- **Authorization in the service layer, authentication at the boundary.** `requireAuth` middleware only verifies the token; role checks (admin-only room mutations, admin-only usage) live in services, so they can't be bypassed by another transport.
- **One error model.** Domain errors carry a code; a single mapper (`http/errorMapper.ts`) turns them into status codes and the `{ error: { code, message, details? } }` envelope. `ROOM_CONFLICT` is its own code (spec §4) sharing 409 with generic conflicts.
- **Local office time.** Booking minute strings ("YYYY-MM-DDTHH:mm") are parsed as local time without timezone conversion, because business hours are local; parsing rejects impossible dates (e.g. Feb 30).
- **Recurrence model:** a booking stores `recurrence: {kind:'weekly', count}`; occurrences are computed by expansion (`expandOccurrences`) at read/conflict/usage time. No per-occurrence rows — simpler and keeps conflict checks transactable in memory.
- **Cancellation cancels the whole series** (booking-level), window checked against the first occurrence's start; admin bypasses the window entirely, non-organizers get 403.
- **`completed` status is computed on read** from the last occurrence's end vs now — history is never mutated on read (spec §4).
- **In-memory persistence behind repository interfaces** (`server/src/repositories/types.ts`); a SQL/document adapter would implement the same three interfaces and be wired in `app.ts` only.
- **Client-side slot/cancel logic is unit-tested pure functions** (`client/src/lib/slots.ts`); components stay presentational. The server remains the authority — the client's 1h-window mirror is UX only.
- **Top organizer in the usage report is ranked by booked minutes** (spec didn't specify the ranking); ties resolve to the first organizer encountered.
- **Token storage: localStorage** with in-memory auth context; acceptable for an internal tool, documented as a tradeoff.
- **Vite dev proxy** `/api` → :3000 so dev and prod share one API surface; production serves the built client statically from Express with an SPA fallback.
- **Shared zod schemas validate on both sides** — server boundary (`parseBody`/`parseQuery`) and client forms reuse the same package, so no duplicated validation rules.
