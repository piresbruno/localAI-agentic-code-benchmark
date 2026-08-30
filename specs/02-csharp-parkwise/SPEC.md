# ParkWise — Parking Garage Management API

**Version**: 1.0.0
**Stack**: C# / .NET 8, ASP.NET Core Web API (controllers), EF Core + SQLite, JWT, xUnit
**Audience**: AI coding agents evaluated on building a production-quality .NET Web API.

---

## 1. Overview & Goals

Build **ParkWise**, a REST API managing a multi-level parking garage: entry/exit ticketing, capacity tracking per vehicle type, graduated fee calculation, permit holders, payments, and daily revenue reporting. No UI — HTTP surface only.

**Why this exists.** This project grades an agent's ability to:
- Translate a written spec into a working ASP.NET Core service.
- Implement money-safe calculations (decimal, banker's rounding rules) — float math here is a **fail**.
- Model time-based business logic (fee brackets, grace periods, overnight stays, lost tickets).
- Enforce concurrency constraints (full garage → queueing/denial semantics).
- Use layered .NET patterns (controllers → services → repositories, DI, options pattern) and EF Core correctly.

**LOC expectation.** ~2,000–3,000 lines of C#. Significantly less = missing features; more = over-engineering.

## 2. Success criterion (pass/fail)

ALL of the following must be true:

1. **Sandboxed** — no external services; SQLite file lives inside the run directory (or in-memory provider via config).
2. **Ready to run** — clean checkout: `dotnet restore` → `dotnet ef database update` (or auto-migrate on boot) → `dotnet run`. `GET /health` → 200. Default admin seeded automatically. Env vars have safe local defaults documented in README.
3. **Swagger UI** — `/swagger` serves OpenAPI describing every endpoint in §5.
4. **All tests pass** (`dotnet test`), and **line coverage ≥ 75%** (coverlet) on the business-logic and API projects.

## 3. Architecture (REQUIRED — deviations = fail)

```
ParkWise/
├── ParkWise.sln
├── src/
│   ├── ParkWise.Api/          # ASP.NET Core: controllers, middleware, DI wiring, Program.cs
│   ├── ParkWise.Services/     # ALL business logic (pure; IClock, IFeeCalculator injected)
│   │   ├── Fees/              # fee calculation strategies
│   │   └── ...
│   ├── ParkWise.Data/         # EF Core DbContext, entities, configurations, migrations
│   └── ParkWise.Contracts/    # request/response DTOs shared across layers
└── tests/
    ├── ParkWise.UnitTests/    # services with fixed IClock; no EF, in-memory fakes
    └── ParkWise.IntegrationTests/  # WebApplicationFactory + real SQLite
```

Rules:
- **Controllers contain no business logic.** They map HTTP ↔ service calls.
- `ParkWise.Services` references no ASP.NET/EF packages. Domain types own their invariants; constructors reject invalid state.
- `IClock` abstraction for all time (`DateTime.UtcNow` may appear only in the clock implementation and Program.cs wiring).
- Money is `decimal`, currency EUR. Rounding: to cents, **away from zero** at final step only (document it).
- EF Core: explicit entity configurations (`IEntityTypeConfiguration`), no query logic in controllers, `AsNoTracking` for reads.

## 4. Domain model

**Levels & bays**: Garage has levels 1–3. Bay types: `motorcycle`, `compact`, `standard`, `ev` (ev has a charger). Counts per level defined in config (`GarageOptions`). A vehicle type can occupy its own bay type or a larger one (motorcycle→any, compact→compact/standard, standard→standard, ev→ev preferred, else standard).

**Vehicles & tickets**: On entry (`POST /entries`): plate (regex `^[A-Z]{2}-\d{3}-[A-Z]{2}$`), vehicle type → issue `Ticket { id, plate, vehicleType, bayId, entryAt, status }`. Ticket status: `open`, `paid`, `exited`, `lost`.

**Fees (config-driven, `FeeOptions`):**
- Free first **15 minutes** (grace, both on unpaid-exit attempt and after payment).
- Rates per hour by type: motorcycle 1.00, compact 2.00, standard 3.00, ev 3.50 (EUR).
- Billed per started hour, but **daily cap** 20.00 per 24h-period inside one stay.
- EV: charging included; if `evChargingUsed` flag set on payment → flat +2.50.
- **Lost ticket**: flat 25.00 (replaces time-based fee).
- **Permits**: vehicle may present permit code (seeded); active permit → fee 0 while permit valid, but the entry still occupies a bay. Expired permit → normal fees. `GET /permits/validate?plate=` for attendants.

**Business rules (each needs a test named for it):**
- `denies_entry_when_no_compatible_bay_free` → 409 `GARAGE_FULL` (plus which types are full in `details`).
- `frees_bay_on_exit` — capacity must recover after exit; concurrent entries must not exceed capacity (test with parallel tasks).
- `applies_grace_period_on_unpaid_exit` — exit request ≤ 15 min after entry → fee 0, auto-complete.
- `charges_started_hours_up_to_daily_cap` — e.g., 7h15m standard = 8 × 3.00 = 24.00; 20h = cap 20.00.
- `charges_flat_fee_for_lost_ticket`.
- `blocks_paid_ticket_double_exit` — second exit attempt → 409 `ALREADY_EXITED`.
- `requires_payment_before_exit_when_fee_due` — exit with unpaid fee → 402 with fee quote.
- `rejects_malformed_plate` → 422.
- `enforces_attendant_role` — entries/exits/payments: role `attendant` or `admin`; reports/admin endpoints: `admin`; permits read: `attendant`.

**Payments**: `POST /payments { ticketId, method: card|cash|app }` → marks ticket `paid`, returns receipt id. Refund endpoint (admin) within 24h of payment.

**Reports** (admin): `GET /admin/revenue/daily?from=&to=` — per day: gross, per-method split, lost-ticket fees, permit-exempt stays count. `GET /admin/occupancy` — current per-type usage.

## 5. API surface (all `/api` prefixed)

- `POST /auth/login` (attendant/admin seeded; JWT 8h) · `GET /health`
- `POST /entries` · `GET /entries/{ticketId}` · `POST /exits/{ticketId}` (quote if unpaid; complete if paid/grace)
- `GET /tickets/{ticketId}/quote` — current fee preview (no side effects)
- `POST /payments` · `GET /payments/{id}` · `POST /payments/{id}/refund` (admin)
- `POST /permits` / `GET /permits` / `GET /permits/validate` / `DELETE /permits/{code}` (admin, except validate)
- `GET /admin/occupancy` · `GET /admin/revenue/daily`
- Errors: `{ error: { code, message, details? } }` via one exception-handling middleware + problem mapping; consistent codes: `GARAGE_FULL`, `ALREADY_EXITED`, `PAYMENT_REQUIRED`, `TICKET_NOT_FOUND`, `PLATE_INVALID`, `PERMIT_EXPIRED`.

## 6. Configuration (options pattern)

`GarageOptions` (levels, bay counts), `FeeOptions` (rates, caps, grace), `AuthOptions` (secret, issuer, expiry) — bound from `appsettings.json` + env vars, validated at startup (`IValidateOptions`); invalid config = boot failure with clear message.

## 7. Testing requirements

- **Unit tests** (`ParkWise.UnitTests`): fee calculator matrix (minutes boundaries: 14:59/15:00/15:01, hour boundaries, multi-day, cap interactions, EV flag, lost ticket), capacity logic with fake clock, permit expiry. Fixed `IClock` everywhere.
- **Integration tests** (`WebApplicationFactory` + SQLite in-memory or temp file): full flows — entry→quote→pay→exit; garage-full under parallel load; authz 401/403; validation 422.
- Every §4 named rule = named test. No `DateTime.Now` in tests (fixed clock).
- Coverage ≥ 75% on `src/ParkWise.Services` + `src/ParkWise.Api` (coverlet). Treat warnings as errors builds clean.

## 8. Commands

| Purpose | Command |
|---|---|
| Restore/build | `dotnet build` |
| Run | `dotnet run --project src/ParkWise.Api` |
| Test | `dotnet test` |
| Coverage | `dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura` (or `--collect:"XPlat Code Coverage"`) |

## 9. Documentation

README: goal, quickstart (≤ 3 cmds), architecture overview, seeded accounts, fee table with worked examples, config reference, API summary (link Swagger). `docs/DECISIONS.md`: rounding policy, concurrency approach (how capacity is protected), migration strategy.