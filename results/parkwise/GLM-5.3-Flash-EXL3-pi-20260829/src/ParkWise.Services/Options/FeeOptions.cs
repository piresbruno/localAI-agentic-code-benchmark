using Microsoft.Extensions.Options;

namespace ParkWise.Services.Options;

/// <summary>Fee configuration (all money EUR, decimal).</summary>
public class FeeOptions
{
    public const string SectionName = "Fees";

    /// <summary>Grace window in minutes: stays up to this length are free.</summary>
    public int GraceMinutes { get; set; } = 15;

    /// <summary>Hourly rates per vehicle type (EUR).</summary>
    public decimal MotorcycleRatePerHour { get; set; } = 1.00m;
    public decimal CompactRatePerHour { get; set; } = 2.00m;
    public decimal StandardRatePerHour { get; set; } = 3.00m;
    public decimal EvRatePerHour { get; set; } = 3.50m;

    /// <summary>Daily cap per 24h-period for stays spanning multiple calendar days.</summary>
    public decimal DailyCap { get; set; } = 20.00m;

    /// <summary>Flat surcharge when EV charging was used during the stay.</summary>
    public decimal EvChargingSurcharge { get; set; } = 2.50m;

    /// <summary>Flat fee replacing the time-based fee for lost tickets.</summary>
    public decimal LostTicketFee { get; set; } = 25.00m;

    /// <summary>Refund window in hours after payment.</summary>
    public int RefundWindowHours { get; set; } = 24;
}
