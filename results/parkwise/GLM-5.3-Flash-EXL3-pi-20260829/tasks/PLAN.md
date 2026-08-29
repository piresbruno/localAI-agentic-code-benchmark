# PLAN — parkwise

**Agent/Model**: GLM-5.3-Flash-EXL3 (pi harness)
**Started**: 2026-08-29
**Spec**: /home/piresbruno/developer/code-benchmark/specs/03-csharp-parkwise/SPEC.md
**Mode**: unattended (plan self-approved)

## Understanding of the task

ParkWise is a multi-level parking garage REST API: entry/exit ticketing with bay allocation across vehicle types, graduated config-driven fees (grace period, started hours, daily cap, EV charging, lost tickets, permits), payments with refunds, and admin revenue/occupancy reports. Hard parts: money-safe decimal math with documented rounding, time-based fee brackets tested at minute boundaries, race-safe capacity allocation (parallel entries must not overfill), options-pattern config validated at boot, and clean layering (controllers → services → repositories, Services references no ASP.NET/EF packages).

## Task breakdown

- [ ] T1 — Solution skeleton: 4 src projects + 2 test projects, package refs, `dotnet build` green
      Accept: BUILD_CHECK green with empty skeleton.
- [ ] T2 — Contracts: request/response DTOs, error envelope types
      Accept: builds; DTOs used by controllers later.
- [ ] T3 — Data: entities, enums, IEntityTypeConfiguration, DbContext, seeder (bays, users, permits)
      Accept: DbContext creates SQLite schema; seed idempotent.
- [ ] T4 — Services core: IClock, domain errors, options + IValidateOptions, repository interfaces + EF implementations, PasswordHasher/TokenService abstractions
      Accept: unit-testable without EF (fakes possible).
- [ ] T5 — FeeCalculator: grace 15m, started hours, daily cap, EV +2.50, lost 25.00, permit → 0; away-from-zero rounding at final step
      Accept: fee matrix unit tests pass (14:59/15:00/15:01 boundaries, multi-day, caps).
- [ ] T6 — TicketService: entry (plate regex, bay allocation race-safe), quote, exit (grace/paid/402/409), lost ticket
      Accept: named rule tests pass with fake repos + fixed clock.
- [ ] T7 — PaymentService, PermitService, ReportService (revenue daily, occupancy)
      Accept: unit tests pass; refund only within 24h.
- [ ] T8 — Api: controllers, JWT auth + roles, error-handling middleware, Swagger, options validation at startup, Program.cs wiring
      Accept: `dotnet run` boots; /health 200; /swagger serves.
- [ ] T9 — Integration tests: WebApplicationFactory + SQLite; entry→quote→pay→exit flow, garage-full under parallel load, authz 401/403, 422 validation
      Accept: every §4 named rule has a test; all green.
- [ ] T10 — Docs: README (quickstart, fee table with worked examples, config reference), docs/DECISIONS.md (rounding, concurrency, migrations)
      Accept: clean-checkout quickstart ≤ 3 commands documented.
- [ ] T11 — Quality gates: dotnet build (warnings as errors), dotnet test 100% pass, coverage ≥ 75% on Services+Api (coverlet), smoke boot, security self-review
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

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s:
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
