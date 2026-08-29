# Decisions

One line per non-obvious decision, with the reasoning.

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Business rules live only in `services/`; `http/` maps requests ↔ services; domain never imports express/jwt/React | Spec §3 required architecture; keeps rules pure + unit-testable. |
| 2 | `Clock`/`IdGen` injected everywhere time/ids are created | Spec requires; tests pass fixed values → deterministic. |
| 3 | `shared/` owns DTO types + zod schemas; client re-validates with the same schemas | "Single source" per spec §3; inline form errors identical to API 400s. |
| 4 | Booking start must be in the future | Spec silent; past bookings contradict the read-only `completed` semantics (decision #11). |
| 5 | Weekly recurrence → N independent booking records, each carrying the recurrence def | Matches "creates count occurrences"; cancellation is per occurrence; no seriesId invented. |
| 6 | Store status is `confirmed`/`cancelled` only; `completed` is computed on read | Spec: "never mutate history on read". |
| 7 | scrypt (node:crypto) with salt:hash for passwords, min length 8 | No native compile deps; timing-safe compare; documented default. |
| 8 | JWT payload `{ sub, role }`, 12h expiry, issuer `deskboard`; authz checked in the service layer too | Token validation at the edge, role checks in services (defense in depth). |
| 9 | Error codes are stable (`ROOM_CONFLICT`, `ROOM_NAME_TAKEN`, …) + one HTTP mapper | Spec: one shared error mapper; client keys off `code`. |
| 10 | `GET /rooms` returns inactive rooms with `active:false` | Admin table needs them; booking grid filters client-side. |
| 11 | Deactivated room blocks new bookings (422), existing bookings unaffected | Literal reading of `deactivate blocks new bookings, not existing ones`. |
| 12 | Availability = 11 hourly slots 08:00–19:00; any booking touching a slot marks it busy | Matches the "room × hour grid" UI; adjacent back-to-back slots stay distinct. |
| 13 | Usage: overlap in minutes/60 rounded to 0.1h; cancelled excluded; top organizer by count | Simple, deterministic interpretation of "total booked hours, #bookings, top organizer". |
| 14 | Same-origin serving: Express serves `client/dist` + SPA fallback | Spec: "UI served from same origin"; no CORS machinery. |
| 15 | Server runs compiled `dist`; `npm start` rebuilds (shared → server → client) | Guarantees a clean checkout boots with exactly `npm install` + `npm start`. |
| 16 | JWT secret defaults to a dev value with a startup warning | "Safe local defaults"; README instructs production override. |
| 17 | Coverage gate measured on `server/src/**` + `shared/src/**` only | Spec §2 item 6; client needs ≥8 RTL tests instead (have 15). |
