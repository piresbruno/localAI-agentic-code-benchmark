# PLAN — parkwise

**Agent/Model**: GLM-5.3-Flash-EXL3 (pi harness)
**Started**: 2026-08-29
**Spec**: /home/piresbruno/developer/code-benchmark/specs/03-csharp-parkwise/SPEC.md
**Mode**: unattended (plan self-approved)

## Understanding of the task

ParkWise is a multi-level parking garage REST API: entry/exit ticketing with bay allocation across vehicle types, graduated config-driven fees (grace period, started hours, daily cap, EV charging, lost tickets, permits), payments with refunds, and admin revenue/occupancy reports. Hard parts: money-safe decimal math with documented rounding, time-based fee brackets tested at minute boundaries, race-safe capacity allocation (parallel entries must not overfill), options-pattern config validated at boot, and clean layering (controllers → services → repositories, Services references no ASP.NET/EF packages).

## Task breakdown

- [x] T1 — Solution skeleton: 4 src projects + 2 test projects, package refs, `dotnet build` green
      Accept: BUILD_CHECK green with empty skeleton.
- [x] T2 — Contracts: request/response DTOs, error envelope types
      Accept: builds; DTOs used by controllers later.
- [x] T3 — Data: entities, enums, IEntityTypeConfiguration, DbContext, seeder (bays, users, permits)
      Accept: DbContext creates SQLite schema; seed idempotent.
- [x] T4 — Services core: IClock, domain errors, options + IValidateOptions, repository interfaces + EF implementations, PasswordHasher/TokenService abstractions
      Accept: unit-testable without EF (fakes possible).
- [x] T5 — FeeCalculator: grace 15m, started hours, daily cap, EV +2.50, lost 25.00, permit → 0; away-from-zero rounding at final step
      Accept: fee matrix unit tests pass (14:59/15:00/15:01 boundaries, multi-day, caps).
- [x] T6 — TicketService: entry (plate regex, bay allocation race-safe), quote, exit (grace/paid/402/409), lost ticket
      Accept: named rule tests pass with fake repos + fixed clock.
- [x] T7 — PaymentService, PermitService, ReportService (revenue daily, occupancy)
      Accept: unit tests pass; refund only within 24h.
- [x] T8 — Api: controllers, JWT auth + roles, error-handling middleware, Swagger, options validation at startup, Program.cs wiring
      Accept: `dotnet run` boots; /health 200; /swagger serves.
- [x] T9 — Integration tests: WebApplicationFactory + SQLite; entry→quote→pay→exit flow, garage-full under parallel load, authz 401/403, 422 validation
      Accept: every §4 named rule has a test; all green.
- [x] T10 — Docs: README (quickstart, fee table with worked examples, config reference), docs/DECISIONS.md (rounding, concurrency, migrations)
      Accept: clean-checkout quickstart ≤ 3 commands documented.
- [x] T11 — Quality gates: dotnet build (warnings as errors), dotnet test 100% pass, coverage ≥ 75% on Services+Api (coverlet), smoke boot, security self-review
      Accept: all gates green; final report printed.

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Daily cap applies when a stay spans multiple calendar days; capped per 24h-period-from-entry at 20.00. Same-day stays bill pure started hours (7h15m standard = 24.00; 20h crossing midnight = 20.00) | Spec examples 24.00 and 20.00 are mutually inconsistent under any uniform per-period cap; this reading satisfies both named examples; documented in DECISIONS.md |
| 2 | Database via `EnsureCreated` on boot (no migration files) | Spec explicitly allows auto-migrate on boot; migration strategy discussed in DECISIONS.md |
| 3 | Race-safe capacity via conditional `UPDATE ... WHERE Status=Free` per candidate bay (optimistic allocation) | Correct under concurrent writers on SQLite without lock pragmas |
| 4 | Seeded accounts: admin@parkwise.local / attendant@parkwise.local (passwords in config, local defaults) | Spec requires seeded attendant/admin; secrets via options, not code |
| 5 | Lost ticket via `POST /tickets/{id}/report-lost` (attendant), then normal pay/exit with flat 25.00 | Spec names ticket status `lost` but no endpoint; simplest explicit flow |

## Final report (fill at the end)

- Wall-clock time: 01:30:27 (harness session JSONL, 03:40:22Z → 05:10:50Z)
- Total tokens consumed (in + out) + avg output t/s: 56,585,806 total (56,479,551 in / 106,255 out), ≈ 19.6 t/s — source: pi session JSONL usage fields, harness telemetry, scoped to this run
- Errors/retries (build/test/lint): ~15, all fixed forward — record-validation metadata on primary constructors, options DI resolution, missing DI using in test host, the ConfigurationBinder list-append bug (GarageOptions doubling), WebApplicationFactory config/Env propagation for minimal hosting (solved via ConfigureServices overrides), test arithmetic errors, line-length warnings
- Final coverage (number + measurement command): 86.49% lines on ParkWise.Services + ParkWise.Api via coverlet (`dotnet test /p:CollectCoverage=true /p:CoverletOutputFormat=cobertura`), merged from both test projects; Services 88.12%, Api 78.99%
- Line counts per directory: Api 536 · Services 1,056 · Data 498 · Contracts 183 (src 2,273) · UnitTests 840 · IntegrationTests 388 (tests 1,228)
- Deviations from spec: daily-cap reading documented in DECISIONS.md (satisfies both named examples); lost ticket via report-lost endpoint; EnsureCreated instead of migration files
- Final gates: dotnet build (warnings as errors) ✅ · 76/76 tests ✅ · coverage 86.49% ✅ · smoke: /health 200, /swagger 200, full entry→pay→exit flow, 401 without JWT ✅ · security self-review ✅
