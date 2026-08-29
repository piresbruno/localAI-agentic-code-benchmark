using ParkWise.Contracts;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Options;

namespace ParkWise.Services;

/// <summary>Admin reporting: daily revenue and current occupancy.</summary>
public class ReportService
{
    private readonly IPaymentRepository _payments;
    private readonly IBayRepository _bays;
    private readonly FeeOptions _feeOptions;

    public ReportService(IPaymentRepository payments, IBayRepository bays, FeeOptions feeOptions)
    {
        _payments = payments;
        _bays = bays;
        _feeOptions = feeOptions;
    }

    /// <summary>Per-day revenue between from and to (UTC days, inclusive from, exclusive to):
    /// gross, per-method split, lost-ticket fees, permit-exempt stay count, refunded amount.</summary>
    public async Task<RevenueReportResponse> RevenueDailyAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        if (toUtc < fromUtc)
        {
            throw new ValidationException( "'to' must be on or after 'from'.", 422);
        }

        var payments = await _payments.GetInRangeAsync(fromUtc, toUtc, ct);
        var days = new List<RevenueDay>();

        for (var day = fromUtc.Date; day < toUtc.Date; day = day.AddDays(1))
        {
            var windowEnd = day.AddDays(1);
            var inDay = payments
                .Where(p => p.PaidAtUtc >= day && p.PaidAtUtc < windowEnd)
                .ToList();

            var gross = inDay.Where(p => p.RefundedAtUtc is null).Sum(p => p.Amount);
            days.Add(new RevenueDay(
                Date: day,
                Gross: Math.Round(gross, 2, MidpointRounding.AwayFromZero),
                Card: Math.Round(inDay.Where(p => p.Method == PaymentMethod.Card && p.RefundedAtUtc is null).Sum(p => p.Amount), 2),
                Cash: Math.Round(inDay.Where(p => p.Method == PaymentMethod.Cash && p.RefundedAtUtc is null).Sum(p => p.Amount), 2),
                App: Math.Round(inDay.Where(p => p.Method == PaymentMethod.App && p.RefundedAtUtc is null).Sum(p => p.Amount), 2),
                LostTicketFees: Math.Round(inDay.Where(p => p.RefundedAtUtc is null && IsLostTicketFee(p)).Sum(p => p.Amount), 2),
                PermitExemptStays: inDay.Count(p => p.PermitExempt),
                Refunds: Math.Round(inDay.Where(p => p.RefundedAtUtc is not null).Sum(p => p.Amount), 2)));
        }

        _ = _feeOptions;
        return new RevenueReportResponse(fromUtc, toUtc, days);
    }

    private bool IsLostTicketFee(PaymentRecord payment)
    {
        // Lost-ticket payments are identifiable by the flat fee amount matching the config.
        return payment.Amount == _feeOptions.LostTicketFee;
    }

    /// <summary>Current occupancy per bay type plus totals.</summary>
    public async Task<OccupancyResponse> OccupancyAsync(CancellationToken ct = default)
    {
        var bays = await _bays.GetAllBaysAsync(ct);
        var entries = new List<OccupancyEntry>();
        int totalFree = 0, totalOccupied = 0;

        foreach (var type in Enum.GetValues<BayType>())
        {
            var ofType = bays.Where(b => b.Type == type).ToList();
            if (ofType.Count == 0)
            {
                continue;
            }
            var occupied = ofType.Count(b => b.Occupied);
            entries.Add(new OccupancyEntry(type.ToString(), ofType.Count, occupied, ofType.Count - occupied));
            totalFree += ofType.Count - occupied;
            totalOccupied += occupied;
        }

        return new OccupancyResponse(entries, totalFree, totalOccupied);
    }
}
