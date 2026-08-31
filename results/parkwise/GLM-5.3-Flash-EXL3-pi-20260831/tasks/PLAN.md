# PLAN — parkwise

**Agent/Model**: GLM-5.3-Flash-EXL3 via pi harness
**Started**: 2026-08-31 04:25
**Spec**: specs/02-csharp-parkwise/SPEC.md (v2.0.0)
**Mode**: unattended (plan self-approved)

## Understanding of the task

ParkWise is a parking-garage service: JWT-authenticated ASP.NET Core API (entries, tickets,
quotes, payments, exits, occupancy) with EF Core + SQLite and a thin attendant console UI
served from the same app. Hard parts: (1) money-safe graduated fee math — decimal only,
per-24h-period daily caps, started-hour ceilings, 15-min grace, flat lost-ticket fee — each
spec example must be a named test; (2) capacity as a concurrency constraint: bay allocation
must hold under parallel entry load and recover on exit (parallel-task test); (3) strict
layering — Services with zero ASP.NET/EF references, injectable IClock/IFeeCalculator,
controllers as pure HTTP mappers; (4) options pattern with IValidateOptions boot-time
validation; (5) a light UI inside the LOC cap with tokens, UX states, and double-submit
safety; (6) coverlet coverage ≥ 75% on Services + Api.

## Task breakdown

- [ ] T1 — Solution skeleton: sln + 4 src projects + 2 test projects, package refs,
      Directory.Build.props (TreatWarningsAsErrors), options classes + IValidateOptions,
      contracts (DTOs, error codes, enums). Accept: `dotnet build` zero warnings.
- [ ] T2 — Data layer: Ticket + PaymentReceipt entities, IEntityTypeConfiguration,
      AppDbContext (SQLite), EnsureCreated on boot. Accept: build green; DbContext opens
      SQLite and creates schema in a test.
- [ ] T3 — Fee calculator TDD: started hours, grace boundary (14:59/15:00/15:01),
      daily cap per 24h period, multi-day, lost ticket — fixed IClock.
      Accept: fee matrix unit tests green incl. every spec example.
- [ ] T4 — Ticket/Garage/Payment services with in-memory fakes: bay allocation + compatibility,
      GARAGE_FULL, frees_bay_on_exit (incl. parallel), grace auto-complete, double-exit block,
      payment-required 402 quote, lost flow. Accept: all §4-named rule unit tests green.
- [ ] T5 — Api layer: Program.cs wiring, JWT auth (8h), controllers (auth/entries/tickets/
      exits/payments/admin), one exception middleware with the §5 error contract, Swagger,
      static UI serving. Accept: integration tests green — full flow, parallel garage-full,
      authz 401/403, validation 422, health.
- [ ] T6 — Coverage hardening ≥ 75% on Services + Api (coverlet), zero failing tests.
- [ ] T7 — Attendant console UI (static HTML/JS/CSS in wwwroot): tokens.css, login + logout,
      new-entry form with inline API errors, active-tickets table with Pay/Exit + live quote,
      occupancy summary (admin), loading/empty/error states, double-submit safety, a11y.
      Accept: UI flows verified against a running app; tokens-only styling.
- [ ] T8 — Docs (README with fee table + worked examples, docs/DECISIONS.md) + final gates +
      smoke (`dotnet run` → /health, /, /swagger) + bookkeeping (METRICS.md, BENCHMARKS.md).

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | UI = static HTML/JS/CSS in wwwroot consuming the same HTTP API | Spec allows it; lightest tech inside the LOC cap, zero build step; rationale documented in docs/DECISIONS.md |
| 2 | Daily cap applied per 24h-period: Σ over periods of min(rate × ceil(started hours in period), cap) | Matches both spec examples; generalizes multi-day stays deterministically; policy documented |
| 3 | Lost tickets: `POST /tickets/{id}/lost` (attendant/admin) marks status lost | Spec defines the lost status + flat fee but §5 has no trigger endpoint; without it the rule is dead code |
| 4 | Capacity concurrency: singleton SemaphoreSlim serializes bay allocate/free in-process | Single-instance app; deterministic under the spec's parallel test; DB-level alternative documented |
| 5 | Schema auto-created via `EnsureCreated()` on boot | Delivers the "no manual migration step" guarantee for SQLite; migration files would be generated noise |
| 6 | Seeded users (admin/attendant) built from AuthOptions at startup, password verified in memory | Observable behavior equals DB seeding; fewer moving parts; credentials documented in README |
| 7 | Occupancy hidden in UI for non-admin attendants | `enforces_attendant_role` restricts the endpoint to admin; UI follows the API contract |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
