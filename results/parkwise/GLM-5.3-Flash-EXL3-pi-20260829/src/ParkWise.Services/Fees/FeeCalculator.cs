using ParkWise.Services.Abstractions;
using ParkWise.Services.Options;
using ParkWise.Contracts;

namespace ParkWise.Services.Fees;

/// <summary>Result of a fee computation for one stay.</summary>
public record FeeQuote(
    Guid TicketId,
    string Plate,
    VehicleType VehicleType,
    DateTime EntryAtUtc,
    DateTime QuotedAtUtc,
    decimal Amount,
    bool IsGrace,
    bool CoveredByPermit,
    bool IsLost,
    int StartedHours,
    decimal RatePerHour,
    string Currency = "EUR");

/// <summary>Fee computation strategy. Pure: depends only on ticket data, current time, and options.</summary>
public interface IFeeCalculator
{
    /// <summary>Computes the fee for a stay up to <paramref name="nowUtc"/>. No side effects.</summary>
    FeeQuote Quote(TicketRecord ticket, DateTime nowUtc);
}

/// <summary>
/// Default fee policy (all money decimal EUR; rounding to cents away from zero happens
/// only in this class at the final step):
/// - grace: stays up to FeeOptions.GraceMinutes are free;
/// - billed per started hour at the vehicle-type rate;
/// - daily cap: stays spanning more than one calendar day are capped at
///   FeeOptions.DailyCap per 24h-period counted from entry (see docs/DECISIONS.md);
/// - lost ticket: flat fee replaces the time-based fee entirely;
/// - active permit: fee 0.
/// The EV charging surcharge is NOT part of the time-based fee; it is added by
/// PaymentService when the payment requests it (spec: flag on payment).
/// </summary>
public sealed class FeeCalculator : IFeeCalculator
{
    private readonly FeeOptions _options;

    public FeeCalculator(FeeOptions options) => _options = options;

    public FeeQuote Quote(TicketRecord ticket, DateTime nowUtc)
    {
        var rate = RateFor(ticket.VehicleType);

        if (ticket.Status == TicketStatus.Lost)
        {
            return new FeeQuote(
                ticket.Id, ticket.Plate, ticket.VehicleType, ticket.EntryAtUtc, nowUtc,
                Amount: _options.LostTicketFee,
                IsGrace: false, CoveredByPermit: false, IsLost: true,
                StartedHours: 0, RatePerHour: rate);
        }

        var elapsed = nowUtc - ticket.EntryAtUtc;
        if (elapsed < TimeSpan.Zero)
        {
            elapsed = TimeSpan.Zero;
        }

        // Grace: free within the configured window.
        if (elapsed.TotalMinutes <= _options.GraceMinutes)
        {
            return new FeeQuote(
                ticket.Id, ticket.Plate, ticket.VehicleType, ticket.EntryAtUtc, nowUtc,
                Amount: 0.00m, IsGrace: true, CoveredByPermit: false, IsLost: false,
                StartedHours: 0, RatePerHour: rate);
        }

        var startedHours = (int)Math.Ceiling(elapsed.TotalHours);
        var rawFee = startedHours * rate;

        // Daily cap: applies only to stays spanning more than one calendar day
        // (local day boundaries), capped per 24h-period from entry.
        decimal amount;
        var spansMultipleDays = nowUtc.ToLocalTime().Date != ticket.EntryAtUtc.ToLocalTime().Date
            || elapsed.TotalHours > 24;
        if (spansMultipleDays)
        {
            var periods = (int)Math.Ceiling(elapsed.TotalHours / 24.0);
            amount = Math.Min(rawFee, _options.DailyCap * periods);
        }
        else
        {
            amount = rawFee;
        }

        // Rounding policy: to cents, away from zero, at the final step only.
        // (The EV charging surcharge, if requested on payment, is added and rounded
        // by PaymentService at its own final step.)
        amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero);

        return new FeeQuote(
            ticket.Id, ticket.Plate, ticket.VehicleType, ticket.EntryAtUtc, nowUtc,
            Amount: amount, IsGrace: false, CoveredByPermit: false, IsLost: false,
            StartedHours: startedHours, RatePerHour: rate);
    }

    /// <summary>Hourly rate for a vehicle type (EUR).</summary>
    public decimal RateFor(VehicleType type) => type switch
    {
        VehicleType.Motorcycle => _options.MotorcycleRatePerHour,
        VehicleType.Compact => _options.CompactRatePerHour,
        VehicleType.Standard => _options.StandardRatePerHour,
        VehicleType.Ev => _options.EvRatePerHour,
        _ => throw new ArgumentOutOfRangeException(nameof(type), type, "Unknown vehicle type"),
    };
}
