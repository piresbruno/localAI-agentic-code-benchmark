# ParkWise

Parking garage management API: entry/exit ticketing, capacity tracking across vehicle/bay types, graduated config-driven fees (grace period, started hours, daily cap, EV charging, lost tickets, permits), payments with refunds, and admin revenue/occupancy reports. C# / .NET 8, ASP.NET Core controllers, EF Core + SQLite, xUnit.

## Quickstart

```bash
dotnet restore
dotnet run --project src/ParkWise.Api
```

Open **http://localhost:5092/swagger** (the port is printed at boot). `GET /health` returns 200. The database (SQLite, inside the run directory) and seed data are created automatically on boot.

## Seeded accounts

| Role | Username | Password |
|---|---|---|
| Admin | `admin` | `admin123` |
| Attendant | `attendant` | `attendant123` |

`POST /api/auth/login` returns a JWT (8h expiry) used as `Authorization: Bearer <token>`.

## Fee table (EUR, config-driven)

| Rule | Value |
|---|---|
| Grace period | first 15 minutes free |
| Motorcycle | 1.00 / started hour |
| Compact | 2.00 / started hour |
| Standard | 3.00 / started hour |
| EV | 3.50 / started hour (charger bay) |
| EV charging used (flag on payment) | +2.50 flat |
| Daily cap | 20.00 per 24h period (stays spanning multiple calendar days) |
| Lost ticket | 25.00 flat (replaces time-based fee) |
| Active permit | 0.00 for the whole stay |

Worked examples (standard, 3.00/h):
- 14 min → 0.00 (grace) · 15 min → 0.00 (grace) · 15 min 1 s → 3.00
- 7 h 15 m, same calendar day → 8 started hours × 3.00 = **24.00**
- 20 h (crosses midnight) → capped at **20.00** per 24h period
- 30 h → min(90, 20×2) = **40.00**
- 7 h 15 m compact → 8 × 2.00 = 16.00 · lost ticket → 25.00 regardless of duration

Rounding: `decimal` throughout; rounded to cents **away from zero at the final step only**.

## Configuration (options pattern, validated at startup)

| Key | Default | Meaning |
|---|---|---|
| `Garage:Levels` | 3 | Number of levels (1–3) |
| `Garage:Bays[n]:Level/Type/Count` | see appsettings.json | Bay layout per level |
| `Fees:GraceMinutes` | 15 | Free window |
| `Fees:*RatePerHour` | 1.00/2.00/3.00/3.50 | Hourly rates |
| `Fees:DailyCap` | 20.00 | Cap per 24h period |
| `Fees:EvChargingSurcharge` | 2.50 | Flat surcharge |
| `Fees:LostTicketFee` | 25.00 | Flat lost-ticket fee |
| `Fees:RefundWindowHours` | 24 | Refund window |
| `Auth:Secret` | dev-only default | JWT signing key — **set in production** |
| `Auth:TokenExpiryHours` | 8 | JWT lifetime |
| `Auth:AdminUsername/Password`, `Auth:AttendantUsername/Password` | see appsettings.json | Seeded operators |
| `Database:Path` | `<bin>/parkwise.db` | SQLite file location |

Invalid configuration fails the boot with a clear message (`IValidateOptions` + `ValidateOnStart`). Every value can be overridden with environment variables (`Garage__Levels`, `Auth__Secret`, ...).

## API summary

All endpoints under `/api`; full OpenAPI at `/swagger`.

- `POST /api/auth/login` · `GET /health`
- `POST /api/entries` · `GET /api/entries/{ticketId}` · `POST /api/exits/{ticketId}` · `GET /api/tickets/{ticketId}/quote` · `POST /api/tickets/{ticketId}/report-lost` — attendant/admin
- `POST /api/payments` · `GET /api/payments/{id}` — attendant/admin · `POST /api/payments/{id}/refund` — admin
- `POST /api/permits` / `GET /api/permits` / `DELETE /api/permits/{code}` — admin · `GET /api/permits/validate?plate=` — attendant/admin
- `GET /api/admin/occupancy` · `GET /api/admin/revenue/daily?from=&to=` — admin

Errors use one envelope: `{ "error": { "code", "message", "details?" } }` with codes `GARAGE_FULL`, `ALREADY_EXITED`, `PAYMENT_REQUIRED` (402 with quote), `TICKET_NOT_FOUND`, `PLATE_INVALID`, `PERMIT_EXPIRED`, and friends. Exit codes: this is an HTTP API — the same codes appear in the error envelope; HTTP statuses: 409 conflicts, 402 payment required, 422 validation, 401/403 auth.

## Development

```bash
dotnet build            # warnings treated as errors
dotnet test             # 76 tests (59 unit + 17 integration)
dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura
```

See [`docs/DECISIONS.md`](docs/DECISIONS.md) for the rounding policy, the daily-cap interpretation, the concurrency approach for capacity, and the migration strategy.
