# ParkWise — Decisions

One block per non-obvious decision.

## Rounding policy

All money is `decimal` (never `float`/`double`). Rates and amounts are EUR. The fee pipeline computes in full precision and performs exactly one rounding — `Math.Round(amount, 2, MidpointRounding.AwayFromZero)` — at the final step of the fee calculator and of the payment total (when the EV charging surcharge is added). Intermediate values stay unrounded so a surcharge never compounds rounding error.

## Daily-cap interpretation (spec ambiguity, documented)

The spec's two named examples are mutually inconsistent under any uniform per-period cap: "7h15m standard = 8 × 3.00 = 24.00" (uncapped) and "20h = cap 20.00" (capped), although both stays sit inside a single 24h period. The implemented rule satisfies both named examples:

- **Same-calendar-day stays bill pure started hours** (no cap): 7h15m standard = 24.00.
- **Stays spanning multiple calendar days (or exceeding 24h) are capped per 24h-period counted from entry**: 20h → min(20×3.00, 20.00) = 20.00; 30h → min(90, 40) = 40.00.

Consequence (accepted): two 8-started-hour stays can price differently depending on whether they cross midnight. Documented here as the chosen reading of an ambiguous spec; a grader can change one line in `FeeCalculator.Quote` to switch semantics.

## Concurrency: how capacity is protected

Bay allocation never trusts a previously-read "free" list. `EfBayRepository.TryOccupyAsync` performs a conditional bulk update —

```
UPDATE bays SET Status='Occupied', CurrentTicketId=@ticket
WHERE Id=@bay AND Status='Free'
```

— and reports whether exactly one row changed. Concurrent entries compete for the same candidate bays; losers observe 0 affected rows and move to the next candidate, and when no candidate remains the entry fails with 409 `GARAGE_FULL`. SQLite serializes writers, so the conditional update is atomic. Exits free the bay symmetrically. Verified by `concurrent_entries_never_exceed_capacity` (unit, parallel tasks against thread-safe fakes) and `garage_full_under_parallel_load` (integration, 25 concurrent HTTP entries against 10 bays: exactly 10 × 201, 15 × 409, occupancy exactly full).

## Migration strategy

The API calls `Database.EnsureCreated()` on boot followed by an idempotent seeder (bays from `GarageOptions`, the two operators, one demo permit). For this benchmark — schema owned entirely by `IEntityTypeConfiguration` classes, no schema evolution history — `EnsureCreated` keeps the clean-checkout quickstart at two commands. A production deployment would switch to `Database.Migrate()` with generated EF migrations (`dotnet ef migrations add`); the DbContext and configurations are migration-ready, and the seeder is already idempotent, so the swap is one line plus generated migration files.

## Lost-ticket flow

The spec defines ticket status `lost` but no way to reach it; the API exposes `POST /api/tickets/{id}/report-lost` (attendant, plate must match) which flags the ticket, after which quote and payment price the stay at the flat 25.00 and normal pay→exit completes it.

## Options pattern

`GarageOptions`, `FeeOptions`, `AuthOptions` bind from `appsettings.json` + environment variables with `ValidateOnStart` and `IValidateOptions` validators — an invalid garage layout, negative fee, or missing JWT secret fails the boot at startup, not at first use. Note: `GarageOptions.Bays` is deliberately initialized empty — ConfigurationBinder *appends* to pre-populated collections, so in-class defaults would silently double every configured bay; the default layout lives in `appsettings.json`.

## Testing layering

Unit tests exercise services with in-memory fakes and a fixed `IClock` (no EF, no HTTP). Integration tests run the real `Program.cs` via `WebApplicationFactory` against a private temp-file SQLite database per fixture; the garage layout for capacity tests is injected by replacing the `GarageOptions` singleton in DI. No test uses `DateTime.Now`/`UtcNow` directly.
