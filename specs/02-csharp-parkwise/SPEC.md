# ParkWise — Parking Garage Management API + Attendant Console

**Version**: 2.0.0 (reduced-scope edition with UI; supersedes v1)
**Stack**: C# / .NET 8, ASP.NET Core, EF Core + SQLite, JWT, xUnit. **UI technology is the candidate's choice** (see §6) — server-rendered Razor, Blazor, or a static HTML/JS/CSS client served by the app are all acceptable.
**Audience**: AI coding agents evaluated on building a production-quality .NET service with a thin UI on top.

> **v2 scope.** Compared to v1 this edition drops permits, refunds, the EV charging
> surcharge, the revenue report, and multi-level routing (one flat pool of bays per
> type), and adds a minimal attendant-console UI. Everything specified here is
> required; nothing from v1 carries over implicitly.

---

## 1. Overview & Goals

Build **ParkWise**, a service managing a parking garage: entry/exit ticketing, capacity tracking per vehicle type, graduated fee calculation, payments, and current occupancy reporting — plus a **minimal attendant console UI** over the same API.

**Why this exists.** This project grades an agent's ability to:
- Translate a written spec into a working ASP.NET Core service.
- Implement money-safe calculations (decimal, documented rounding) — float math here is a **fail**.
- Model time-based business logic (fee brackets, grace periods, overnight stays, lost tickets).
- Enforce concurrency constraints (full garage → denial semantics under parallel load).
- Use layered .NET patterns (controllers → services → repositories, DI, options pattern) and EF Core correctly.
- Build a usable UI on top of the API within a tight budget.

**LOC expectation.** 600–1,000 lines of production C# (API + UI, hard cap 1,000). Tests are excluded from the cap but belong in the repo. Significantly less than 600 usually means features are missing; significantly more than 1,000 usually means over-engineering.

## 2. Success criterion (pass/fail)

ALL of the following must be true:

1. **Sandboxed** — no external services; the SQLite file lives inside the run directory (or in-memory provider via config).
2. **Ready to run** — clean checkout: `dotnet run` (auto-migrate on boot — no manual migration step). `GET /health` → 200. Default `admin` and `attendant` accounts seeded automatically. Env vars have safe local defaults documented in README.
3. **UI works** — an attendant logs in at `/`, registers an entry, sees active tickets with a live fee quote, records a payment, completes an exit, and sees current occupancy. (Verified by the grader via SMOKE_CHECK + clicking through.)
4. **UI quality** — design tokens per §6, loading/empty/error states on every data view, double-submit-safe actions. Spot-checked manually; scored in the rubric's UI/UX category.
5. **Swagger UI** — `/swagger` serves OpenAPI describing every API endpoint in §5.
6. **All tests pass** (`dotnet test`), and **line coverage ≥ 75%** (coverlet) on `ParkWise.Services` + `ParkWise.Api` (the UI is excluded from the coverage gate; its behavior is verified by smoke + click-through).

## 3. Architecture (REQUIRED — deviations = fail)

```
ParkWise/
├── ParkWise.sln
├── src/
│   ├── ParkWise.Api/          # ASP.NET Core: controllers, middleware, DI wiring, Program.cs
│   │   └── (UI assets live here or in a dedicated project — candidate's choice, §6)
│   ├── ParkWise.Services/     # ALL business logic (pure; IClock, IFeeCalculator injected)
│   │   └── Fees/              # fee calculation
│   ├── ParkWise.Data/         # EF Core DbContext, entities, configurations
│   └── ParkWise.Contracts/    # request/response DTOs shared across layers
└── tests/
    ├── ParkWise.UnitTests/    # services with fixed IClock; no EF, in-memory fakes
    └── ParkWise.IntegrationTests/  # WebApplicationFactory + real SQLite
```

Rules:
- **Controllers contain no business logic.** They map HTTP ↔ service calls.
- `ParkWise.Services` references no ASP.NET/EF packages. Domain types own their invariants; constructors reject invalid state.
- `IClock` abstraction for all time (`DateTime.UtcNow` may appear only in the clock implementation and Program.cs wiring).
- Money is `decimal`, currency EUR. Rounding: to cents, **away from zero** at the final step only (document it).
- EF Core: explicit entity configurations (`IEntityTypeConfiguration`), no query logic in controllers, `AsNoTracking` for reads. Database schema is created automatically on boot.
- The UI consumes the same HTTP API (or server-rendered pages call services directly — candidate's choice, documented); business rules are never duplicated in the UI beyond display formatting.

## 4. Domain model

**Bays**: one flat pool per bay type — `motorcycle`, `compact`, `standard`, `ev` (ev has a charger). Counts per type defined in config (`GarageOptions`). A vehicle type can occupy its own bay type or a larger one: motorcycle → any; compact → compact/standard; standard → standard; ev → ev preferred, else standard.

**Vehicles & tickets**: On entry (`POST /entries`): plate (regex `^[A-Z]{2}-\d{3}-[A-Z]{2}$`), vehicle type → issue `Ticket { id, plate, vehicleType, bayId, entryAt, status }`. Ticket status: `open`, `paid`, `exited`, `lost`.

**Fees (config-driven, `FeeOptions`):**
- Free first **15 minutes** (grace, applied on unpaid-exit attempt).
- Rates per started hour: motorcycle 1.00, compact 2.00, standard 3.00, ev 3.50 (EUR).
- **Daily cap** 20.00 per 24h-period inside one stay.
- **Lost ticket**: flat 25.00 (replaces time-based fee).

**Payments**: `POST /payments { ticketId, method: card|cash|app }` → marks ticket `paid`, returns receipt id.

**Business rules (each needs a test named for it):**
- `denies_entry_when_no_compatible_bay_free` → 409 `GARAGE_FULL` (plus which types are full in `details`).
- `frees_bay_on_exit` — capacity must recover after exit; concurrent entries must not exceed capacity (test with parallel tasks).
- `applies_grace_period_on_unpaid_exit` — exit request ≤ 15 min after entry → fee 0, auto-complete.
- `charges_started_hours_up_to_daily_cap` — e.g., 7h15m standard = 8 × 3.00 = 24.00; 20h = cap 20.00.
- `charges_flat_fee_for_lost_ticket`.
- `blocks_paid_ticket_double_exit` — second exit attempt → 409 `ALREADY_EXITED`.
- `requires_payment_before_exit_when_fee_due` — exit with unpaid fee → 402 with fee quote.
- `rejects_malformed_plate` → 422.
- `enforces_attendant_role` — entries/exits/payments: role `attendant` or `admin`; occupancy endpoint: `admin`.

## 5. API surface (all `/api` prefixed)

- `POST /auth/login` (attendant + admin seeded; JWT 8h) · `GET /health`
- `POST /entries` · `GET /tickets?status=open` · `GET /tickets/{ticketId}` (status + current fee quote)
- `POST /exits/{ticketId}` (quote if unpaid; complete if paid/grace)
- `POST /payments` · `GET /payments/{id}`
- `GET /admin/occupancy` — per-type used/total
- Errors: `{ error: { code, message, details? } }` via one exception-handling middleware; consistent codes: `GARAGE_FULL`, `ALREADY_EXITED`, `PAYMENT_REQUIRED`, `TICKET_NOT_FOUND`, `PLATE_INVALID`.

## 6. UI requirements — attendant console (technology = candidate's choice)

The UI is served by the same app at `/`. Choose the lightest technology that meets these requirements **within the LOC cap** and document the choice + rationale in `docs/DECISIONS.md` (e.g., static HTML/JS/CSS served from `wwwroot`, Razor Pages, or Blazor — all acceptable; if a build step is needed it must run as part of `dotnet build`).

Required, regardless of technology:

- **Login view** — token/session handled per the chosen tech; logout.
- **New entry form** — plate + vehicle type; inline validation errors from the API error contract (e.g., malformed plate).
- **Active tickets table** — from `GET /tickets?status=open`: entry time, plate, vehicle type, bay, current fee quote; actions **Pay** and **Exit** per row (Exit completes when paid or within grace; shows the 402 quote otherwise).
- **Occupancy summary** — per-type used/total, always visible or one click away.
- **Design tokens**: a single tokens file (CSS variables or equivalent) is the source for colors, typography scale (≥ 3 sizes), and spacing (4/8px grid). No hardcoded hex/off-scale values (rubric deduction).
- **UX states**: loading, empty, and error states on every data view; friendly error text from the API contract, never raw JSON.
- **Interaction feedback**: actions are double-submit safe (disabled while in flight); success/failure feedback via toast or inline message.
- **Accessibility basics**: keyboard-operable, real labels tied to inputs, visible focus, status never conveyed by color alone.
- **No business rules in the UI** beyond display formatting; no component libraries required (plain CSS is fine).

## 7. Configuration (options pattern)

`GarageOptions` (bay counts per type), `FeeOptions` (rates, cap, grace, lost-ticket fee), `AuthOptions` (secret, issuer, expiry) — bound from `appsettings.json` + env vars, validated at startup (`IValidateOptions`); invalid config = boot failure with clear message.

## 8. Testing requirements

- **Unit tests** (`ParkWise.UnitTests`): fee calculator matrix (minutes boundaries: 14:59/15:00/15:01, hour boundaries, multi-day, cap interactions, lost ticket), capacity logic with fake clock. Fixed `IClock` everywhere — no `DateTime.Now` in tests.
- **Integration tests** (`WebApplicationFactory` + SQLite in-memory or temp file): full flow — entry→quote→pay→exit; garage-full under parallel load; authz 401/403; validation 422.
- Every §4 named rule = named test. Zero warnings (`TreatWarningsAsErrors` or equivalent).
- Coverage ≥ 75% on `ParkWise.Services` + `ParkWise.Api` (coverlet).

## 9. Commands

| Purpose | Command |
|---|---|
| Restore/build | `dotnet build` |
| Run | `dotnet run --project src/ParkWise.Api` |
| Test | `dotnet test` |
| Coverage | `dotnet test --collect:"XPlat Code Coverage"` |

## 10. Documentation

README: goal, quickstart (≤ 3 cmds), architecture overview, seeded accounts, fee table with worked examples, config reference, API summary (link Swagger) + UI usage. `docs/DECISIONS.md`: rounding policy, concurrency approach (how capacity is protected), UI technology choice + rationale.
