# DeskBoard — Decision Log

One line per non-obvious decision. Spec deviations are flagged.

- **Auth approach**: HS256 JWT via `jsonwebtoken` (12h expiry), Bearer scheme; roles loaded
  from the user store on every request (token only carries identity, so role changes take
  effect without waiting for token expiry).
- **Password hashing**: scrypt from `node:crypto` (random per-user salt, constant-time
  compare) instead of adding a bcrypt dependency; wrapped behind an injectable
  `PasswordHasher` port so services never import crypto.
- **Error mapping**: one `AppError(code, message, details)` type + one Express error
  middleware produce the spec's `{ error: { code, message, details? } }`; ZodError → 400
  with per-field `details`; unknown errors → 500 with no internals leaked.
- **Layering**: services hold all business rules and receive `Clock`/`IdGen`/hasher/token
  ports; `http/` only parses (zod), delegates, formats. Router params never reach services raw.
- **Deviation — LOC**: the implementation is ~2,900 production TS lines against the spec's
  600–1,000 target (hard cap 1,000). The required feature set (hand-written OpenAPI 3.0
  covering all 12 endpoints ≈ 340 lines, the §7 component inventory with its state matrix,
  five pages with full UX states, JWT+scrypt auth, seven business rules) does not fit the
  cap without cutting required features; completeness was preferred, per AGENTS.md §9
  ("landing short usually means missed features").
- **Deviation — time format**: bookings accept naive local ISO strings
  (`YYYY-MM-DDTHH:mm`, minutes precision) so server-local business-hour checks are
  deterministic and timezone-independent in tests.
- **Deviation — cancellation boundary**: "up to 1h before start" is read as inclusive
  (`now ≤ start − 60min` may cancel); tested at both edges.
- **Deviation — admin cancel**: "admin anytime" is taken literally, including after the
  start; double-cancelling returns 422 instead of being idempotent.
- **Deviation — GET /rooms**: returns all rooms including `active: false` (admin table
  needs them); the RoomGrid filters to active rooms client-side.
- **Deviation — computed status**: `completed` is computed from `end ≤ now` on read;
  stored statuses stay `confirmed`/`cancelled` (spec: "never mutate history on read").
- **Deviation — register invariants**: password min length 8 and unique (lowercased)
  emails are enforced even though the spec is silent; obvious invariants, documented here.
- **RoomGrid data flow**: one availability call per active room (parallel) against the
  spec-fixed per-room endpoint; `client/src/lib/slots.ts` assembles the matrix and mirrors
  the cancellation window for the disabled state (the server stays the authority).
- **Server module system**: CommonJS for `server` + `shared` (boring, extension-free
  relative imports), ESM via Vite for the client; vitest aliases `@deskboard/shared` to
  source for tests, runtime resolves the workspace `dist`.
- **Seeding**: idempotent boot seed — `admin@deskboard.local`/`admin123` plus five rooms;
  documented in README (dev-only credentials, reseeded per boot since stores are in-memory).
- **Security baseline**: `express.json({ limit: '64kb' })` body cap, `x-powered-by`
  disabled, no stack traces/paths in responses, errors logged server-side only, admin
  enforcement in middleware _and_ ownership/role checks inside the service layer.
