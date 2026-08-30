# PLAN — parkwise

**Agent/Model**: pi (GLM-5.3-Flash-EXL3)
**Started**: 2026-08-30
**Spec**: specs/03-csharp-parkwise/SPEC.md
**Mode**: unattended — plan self-approved (operator explicitly requested a repeat run of the
next project; a 2026-08-29 run for the same model already exists, awaiting grading)

## Understanding of the task

ParkWise is an ASP.NET Core 8 Web API for a 3-level parking garage: entry/exit ticketing with
per-vehicle-type bay allocation, grace periods, per-started-hour fees with a 20.00-per-24h
daily cap, EV charging surcharge, lost-ticket flat fee, plate-linked permits, card/cash/app
payments with 24h refunds, and admin revenue/occupancy reports. Hard parts: (1) money-safe
decimal math with away-from-zero rounding at the final step only; (2) race-safe capacity under
parallel entries (atomic bay claim via a single conditional EF `ExecuteUpdate` inside a
transaction); (3) layered architecture where Services references no ASP.NET/EF packages (domain
records + repository interfaces in Services, entities/mappings in Data); (4) every named §4
business rule needs an identically-named test; (5) JWT auth with seeded admin/attendant and
role-based authorization (402/409/422 semantics via one error middleware).

## Task breakdown

- [ ] T1 — Solution scaffold: `ParkWise.sln`, `src/{Api,Services,Data,Contracts}`,
      `tests/{UnitTests,IntegrationTests}`, Directory.Build.props (nullable, warnings-as-errors),
      package refs (EF Core 8 + Sqlite, JwtBearer, Swashbuckle, xUnit, coverlet.msbuild).
      Accept: `dotnet build` green with TreatWarningsAsErrors.
- [ ] T2 — Contracts: request/response DTOs, error envelope, error code constants.
      Accept: builds; DTOs cover every §5 endpoint payload.
- [ ] T3 — Services (pure): `IClock`, domain records with invariants, domain exceptions,
      `FeeCalculator` (grace/started-hours/daily-cap/EV/lost/permit + rounding policy),
      bay-compatibility logic, repository interfaces, entry/exit/payment/permit/report/auth
      services, options validation interfaces.
      Accept: `dotnet build` green; no ASP.NET/EF reference in Services.csproj.
- [ ] T4 — Data: entities + `IEntityTypeConfiguration`s, `ParkWiseDbContext`, repository
      implementations (atomic bay claim/release), idempotent seeder (bays, users, permits),
      initial EF migration.
      Accept: `dotnet build` green; migration file committed.
- [ ] T5 — Api: Program.cs (options binding + `IValidateOptions` startup validation, auto-migrate,
      JWT bearer, Swagger), controllers for all §5 endpoints, exception-handling middleware with
      `{ error: { code, message, details? } }`, `/health`.
      Accept: `dotnet run` boots, `/health` 200, `/swagger` serves OpenAPI.
- [ ] T6 — Unit tests (fixed IClock, no EF): fee matrix incl. 14:59/15:00/15:01 grace boundaries,
      started-hour boundaries, 20h cap, multi-day caps, EV flag, lost ticket, permit exemption;
      bay compatibility; payment/refund window logic.
      Accept: green; every fee edge named in spec covered.
- [ ] T7 — Integration tests (WebApplicationFactory + SQLite temp file): all nine §4 named-rule
      tests, full flows (entry→quote→pay→exit, refund), authz 401/403, 422 validation,
      parallel-load garage-full, reports.
      Accept: green; every §4 rule has its identically-named test.
- [ ] T8 — Docs + gates: README (quickstart, seeded accounts, fee table w/ worked examples,
      config reference), docs/DECISIONS.md (rounding, concurrency, migration strategy),
      coverage ≥ 75% on Services+Api, boot smoke, final bookkeeping.
      Accept: all gates green; docs committed.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Grace applies to stays ≤ 15 min (inclusive) as fee 0; it is NOT subtracted from billable time | Spec's own example: 7h15m standard = 8 × 3.00 = 24.00 — with grace subtraction it would be 7 × 3.00. |
| 2 | Daily cap splits the stay into 24h periods anchored at entry; each period's started-hours subtotal is capped at 20.00 | Spec: "daily cap 20.00 per 24h-period inside one stay". |
| 3 | Payment settles the quote at payment time; a paid ticket exits without re-quote any time later ("grace after payment") | Spec's grace wording; avoids double-charging between payment and exit. |
| 4 | Lost ticket is indicated by `lostTicket: true` on the payment request (no separate marking endpoint in §5); flat 25.00 replaces time fee; ticket status becomes `lost` | API surface defines no mark-lost endpoint; the payment is the natural place. |
| 5 | Permit exemption is evaluated at exit time: permit valid at exit → fee 0 for the stay; expired → normal fees | Spec: "active permit → fee 0 while permit valid… expired permit → normal fees". |
| 6 | Refund (admin) within 24h of payment sets payment `refunded` and reverts the ticket to `open` (bay stays occupied); gross revenue nets refunds on the original payment day | Refund logically un-settles the ticket so it can be paid again. |
| 7 | Capacity protection: bay claim = single atomic `UPDATE … WHERE free AND type-compatible ORDER BY preference LIMIT 1` via EF `ExecuteUpdate` inside the entry transaction; 0 rows affected → `GARAGE_FULL` with per-type free-bay details | Race-safe under parallel entries without app-level locks; SQLite serializes writers. |
| 8 | EV charging +2.50 applies on top of the (possibly capped) fee when `evChargingUsed` is set; permit-exempt stays pay 0 including charging; lost ticket = 25.00 (+ charging if set) | Literal reading of §4 fee rules with the natural precedence. |
| 9 | Migration strategy: committed EF migration + `Database.Migrate()` on boot; `dotnet ef database update` also works if the tool is installed | Spec allows auto-migrate on boot; keeps the grader flow tool-free. |
| 10 | `GET /health` is served at both `/health` and `/api/health` | §2 says `GET /health`; §5 says everything is `/api` prefixed — serve both. |
| 11 | Error codes beyond the six listed (`PAYMENT_NOT_FOUND`, `PERMIT_NOT_FOUND`, `REFUND_WINDOW_EXPIRED`, `VALIDATION_ERROR`, `INVALID_CREDENTIALS`, `ALREADY_PAID`) reused only where the six don't apply, same envelope | §5 lists the required set; extra endpoints need consistent codes too. |
| 12 | Repeat run of the same model/harness on operator request (2026-08-29 run exists, pending grading) | Operator instruction; built from spec alone. |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
