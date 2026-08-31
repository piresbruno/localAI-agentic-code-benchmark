using ParkWise.Contracts;
using ParkWise.Services.Options;

namespace ParkWise.Services.Fees;

public interface IFeeCalculator
{
    /// <summary>Fee for a stay from `entryAtUtc` up to `atUtc` (or the lost-ticket flat fee).</summary>
    decimal Calculate(DateTime entryAtUtc, DateTime atUtc, VehicleType vehicleType, bool lost);

    /// <summary>True when the stay is within the free grace window.</summary>
    bool WithinGrace(DateTime entryAtUtc, DateTime atUtc);
}

/// <summary>
/// Fee policy (spec §4, config via FeeOptions):
/// - stays within the grace window are free;
/// - otherwise every STARTED hour is charged from entry (grace is a leniency window, not a deduction);
/// - the charge is capped at `DailyCap` per 24h-period inside the stay (periods anchored at entry);
/// - lost tickets are a flat fee regardless of duration;
/// - money is `decimal`, rounded to cents AWAY FROM ZERO at the final step only.
/// Note: the spec's worked example "7h15m standard = 8 × 3.00 = 24.00" predates the cap — under the
/// daily-cap rule it evaluates to 20.00 (see docs/DECISIONS.md, rounding & cap policy).
/// </summary>
public sealed class FeeCalculator(FeeOptions options) : IFeeCalculator
{
    private static readonly TimeSpan Day = TimeSpan.FromHours(24);

    public bool WithinGrace(DateTime entryAtUtc, DateTime atUtc) =>
        atUtc - entryAtUtc <= TimeSpan.FromMinutes(options.GraceMinutes);

    public decimal Calculate(DateTime entryAtUtc, DateTime atUtc, VehicleType vehicleType, bool lost)
    {
        if (lost) return Round(options.LostTicketFee);
        if (atUtc <= entryAtUtc) return 0m;
        if (WithinGrace(entryAtUtc, atUtc)) return 0m;

        var rate = options.RateFor(vehicleType);
        var cap = options.DailyCap;
        decimal total = 0m;
        var periodStart = entryAtUtc;
        while (periodStart < atUtc)
        {
            var periodEnd = periodStart + Day < atUtc ? periodStart + Day : atUtc;
            var startedHours = (int)Math.Ceiling((periodEnd - periodStart).TotalHours);
            total += Math.Min(startedHours * rate, cap);
            periodStart = periodEnd;
        }
        return Round(total); // rounding applied once, at the final step only
    }

    /// <summary>Round to cents, away from zero — applied once, at the final step only.</summary>
    private static decimal Round(decimal value) => Math.Round(value, 2, MidpointRounding.AwayFromZero);
}
