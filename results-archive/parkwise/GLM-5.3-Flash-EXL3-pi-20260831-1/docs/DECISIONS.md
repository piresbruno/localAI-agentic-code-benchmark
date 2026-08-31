# ParkWise Decisions

One line per non-obvious decision.

- **Rounding policy**: all money is `decimal`; values round to cents **away from zero** exactly once, at the final step of a fee computation — intermediate per-period charges stay unrounded.
- **Daily-cap policy**: fee = Σ over each 24h-period of the stay (periods anchored at entry) of `min(startedHoursInPeriod × rate, DailyCap)`. The spec's worked example "7h15m standard = 8 × 3.00 = 24.00" predates its own cap — under the cap rule it evaluates to €20.00, consistent with the "20h → cap €20.00" example and the rule name `charges_started_hours_up_to_daily_cap`.
- **Grace semantics**: the first 15 minutes are free as a leniency window ("≤ 15 min → fee 0, auto-complete on exit"); once exceeded, started hours count **from entry** (not from after grace) — the spec's 7h15m example (8 started hours, not 7) confirms this reading.
- **Concurrency approach**: bay allocate/free and payment/exit transitions run inside a process-wide `SemaphoreSlim(1,1)` singleton, so parallel entries can never double-book a bay (verified by a parallel-task test). Single-instance assumption: a multi-instance deployment would move the critical section into the database (SQLite `BEGIN IMMEDIATE` or a `bays` table with row locks).
- **Capacity model**: no `bays` table — occupancy per bay type = count of active tickets (status open/paid/lost) whose `BayType` matches the pool; bay ids (`S-3`) are allocated as the lowest free number of the chosen pool, freed when a ticket exits.
- **Lost-ticket trigger**: spec §5 lists no endpoint to mark a ticket lost, but the domain has the `lost` status + flat fee — added `POST /api/tickets/{id}/lost` (attendant/admin) so the rule is reachable end-to-end.
- **UI technology**: static HTML/JS/CSS served from `wwwroot`, consuming the same HTTP API — lightest option inside the LOC cap, zero build step, no duplicated business rules (the UI renders API-computed fees only). Chosen over Razor/Blazor for this scope.
- **Auth**: JWT (HS256, 8h) issued from seeded accounts defined in `AuthOptions:Users`; passwords compared with `CryptographicOperations.FixedTimeEquals`; roles enforced declaratively per route (`attendant,admin` for operations, `admin` for occupancy).
- **Seeded users in config, not DB**: observable behavior equals DB seeding; avoids an extra table + hashing scheme for two static accounts — documented trade-off.
- **Config validation**: `IValidateOptions<T>` validators + `ValidateOnStart()`; invalid values (non-positive rates/cap, short secret, malformed user roles) fail boot with explicit messages.
- **Schema creation**: `EnsureCreated()` on boot gives the "no manual migration step" guarantee; SQLite + single context makes migration files unnecessary noise for this scope.
- **Test isolation**: each integration test gets a fresh SQLite temp file injected via the `Database__ConnectionString` env var (env vars outrank appsettings.json in the provider chain); test parallelization is disabled because the env var is process-global.
- **API surface extra**: `/health` (spec) is mirrored at `/api/health` for symmetry with the `/api` prefix convention.
