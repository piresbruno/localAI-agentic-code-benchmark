# ParkWise

Parking-garage management service: entry/exit ticketing, per-type capacity tracking, graduated
fee calculation, payments, and occupancy reporting — plus an attendant console UI.
ASP.NET Core (.NET 8), EF Core + SQLite, JWT auth, xUnit.

## Quickstart (from a clean checkout)

```bash
dotnet build
dotnet run --project src/ParkWise.Api
```

Open **http://localhost:3000** (the console UI), or **http://localhost:3000/swagger** for the API.

The database file (`parkwise.db`) is created automatically on boot — no manual migration step.

### Seeded accounts

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | admin |
| `attendant` | `attendant123` | attendant |

Both are defined in `appsettings.json` (`Auth:Users`) and accepted from boot. JWTs live 8 hours.

## Commands

| Purpose | Command |
|---|---|
| Restore/build | `dotnet build` |
| Run (API + UI on :3000) | `dotnet run --project src/ParkWise.Api` |
| Tests | `dotnet test` |
| Coverage | `dotnet test --collect:"XPlat Code Coverage"` |

Coverage gate: ≥ 75% lines on `ParkWise.Services` + `ParkWise.Api` (coverlet) — current run: **90.3%**.

## Fee table (EUR, per started hour, away-from-zero rounding to cents at the final step)

| Vehicle | Rate/h | Free grace |
|---|---|---|
| Motorcycle | €1.00 | first 15 min |
| Compact | €2.00 | first 15 min |
| Standard | €3.00 | first 15 min |
| EV | €3.50 | first 15 min |

Daily cap **€20.00 per 24h-period** inside one stay. Lost ticket: flat **€25.00**.

**Worked examples** (from the fee calculator's own unit tests):

| Stay | Vehicle | Fee | Why |
|---|---|---|---|
| 14 min 59 s | any | €0.00 | inside grace |
| 15 min | any | €0.00 | grace is inclusive ("≤ 15 min") |
| 15 min 1 s | Standard | €3.00 | 1 started hour |
| 61 min | Standard | €6.00 | 2 started hours |
| 7 h 15 m | Standard | €20.00 | 8 × €3.00 = €24.00 before the daily cap; the cap yields €20.00 (see docs/DECISIONS.md — the spec's example predates the cap) |
| 20 h | Standard | €20.00 | capped (60.00 → 20.00) |
| 30 h | Standard | €38.00 | period 1 (24 h): capped €20.00; period 2 (6 h): 6 × €3.00 = €18.00 |
| 90 min | Motorcycle | €2.00 | 2 × €1.00 |
| any | lost ticket | €25.00 | flat fee replaces time-based fee |

## API summary

Swagger UI: **http://localhost:3000/swagger** (describes every endpoint).

| Endpoint | Auth | Notes |
|---|---|---|
| `POST /api/auth/login` | — | seeded accounts → 8h JWT |
| `GET /health` (also `/api/health`) | — | liveness |
| `POST /api/entries` | attendant/admin | plate `^[A-Z]{2}-\d{3}-[A-Z]{2}$`; 409 `GARAGE_FULL` with full types in details |
| `GET /api/tickets?status=open` | attendant/admin | active tickets with live fee quote |
| `GET /api/tickets/{id}` | attendant/admin | status + current fee quote |
| `POST /api/tickets/{id}/lost` | attendant/admin | marks ticket lost → flat fee |
| `POST /api/exits/{id}` | attendant/admin | completes when paid/within grace; 402 `PAYMENT_REQUIRED` + fee quote otherwise |
| `POST /api/payments` | attendant/admin | `{ ticketId, method: card\|cash\|app }` → receipt |
| `GET /api/payments/{id}` | attendant/admin | receipt |
| `GET /api/admin/occupancy` | **admin** | per-bay-type used/total |

Errors follow `{ error: { code, message, details? } }` via one exception middleware:
`GARAGE_FULL`, `ALREADY_EXITED`, `PAYMENT_REQUIRED`, `TICKET_NOT_FOUND`, `PLATE_INVALID`,
`TICKET_ALREADY_PAID`, `INVALID_CREDENTIALS`, `VALIDATION_ERROR`.

## Attendant console UI

Served by the API at `/` (static HTML/JS/CSS from `wwwroot` — rationale in docs/DECISIONS.md):

- **Login view** — token kept in `sessionStorage`, attached to every API call; logout.
- **New entry form** — plate + vehicle type, inline errors from the API error contract (e.g. malformed plate).
- **Active tickets table** — entry time, plate, vehicle type, bay, live fee quote; **Pay**, **Lost**, **Exit** actions per row; a 402 exit surfaces the quoted fee as a toast.
- **Occupancy summary** — per-type used/total meters, visible to admins (the endpoint is admin-only).
- Design tokens in `wwwroot/css/tokens.css` (single source), loading/empty/error states on every data view, double-submit-safe actions, toasts, keyboard-operable with visible focus.

## Configuration (options pattern, validated at startup)

Bound from `appsettings.json`, overridable by environment variables (double-underscore nesting).

| Section | Keys | Default |
|---|---|---|
| `Database` | `ConnectionString` | `Data Source=parkwise.db` |
| `Garage` | `MotorcycleBays`, `CompactBays`, `StandardBays`, `EvBays` | 2 / 3 / 5 / 1 |
| `Fees` | `GraceMinutes`, `MotorcyclePerHour`, `CompactPerHour`, `StandardPerHour`, `EvPerHour`, `DailyCap`, `LostTicketFee` | 15; 1.00; 2.00; 3.00; 3.50; 20.00; 25.00 |
| `Auth` | `Secret`, `Issuer`, `Audience`, `ExpiryHours`, `Users[]` | dev secret; ParkWise; 8 |

Invalid configuration (e.g. non-positive cap, empty secret, user with unknown role) fails boot
with a clear message via `IValidateOptions` + `ValidateOnStart`.

## Architecture

```
ParkWise.sln
├── src/
│   ├── ParkWise.Api/          controllers, middleware, DI wiring, JWT, wwwroot UI
│   ├── ParkWise.Services/     ALL business logic — no ASP.NET/EF references
│   │   ├── Domain/            Ticket, PaymentReceipt (invariants in constructors)
│   │   ├── Fees/              FeeCalculator (IFeeCalculator, FeeOptions)
│   │   ├── Options/           Garage/Fee/Auth option types
│   │   └── Repositories.cs    ITicketRepository / IPaymentRepository interfaces
│   ├── ParkWise.Data/         AppDbContext, IEntityTypeConfiguration, EF repositories
│   └── ParkWise.Contracts/    DTOs + enums + error codes shared across layers
└── tests/
    ├── ParkWise.UnitTests/    services with fixed IClock + in-memory fakes (no EF)
    └── ParkWise.IntegrationTests/  WebApplicationFactory + real SQLite per test
```

Controllers map HTTP ↔ service calls only. `IClock` is injected everywhere time matters —
`DateTime.UtcNow` exists solely in `SystemClock`. Money is `decimal`. Bay allocation is protected
by a process-wide semaphore (see docs/DECISIONS.md for the concurrency model).

Non-obvious decisions (rounding, cap policy, lost-ticket endpoint, UI choice) are documented in
`docs/DECISIONS.md`.
