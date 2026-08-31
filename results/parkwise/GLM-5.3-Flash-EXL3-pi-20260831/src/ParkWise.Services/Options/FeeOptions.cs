using ParkWise.Contracts;
namespace ParkWise.Services.Options;

/// <summary>Bay pool sizes per bay type (spec §7), bound from configuration.</summary>
public sealed class GarageOptions
{
    public int MotorcycleBays { get; init; } = 2;
    public int CompactBays { get; init; } = 3;
    public int StandardBays { get; init; } = 5;
    public int EvBays { get; init; } = 1;

    public int Total(VehicleType type) => type switch
    {
        VehicleType.Motorcycle => MotorcycleBays,
        VehicleType.Compact => CompactBays,
        VehicleType.Standard => StandardBays,
        VehicleType.Ev => EvBays,
        _ => 0,
    };
}

/// <summary>Fee schedule (spec §7): grace, per-started-hour rates, daily cap, lost-ticket flat fee.</summary>
public sealed class FeeOptions
{
    /// <summary>Stays up to this many minutes are free (grace, applied on unpaid-exit attempt).</summary>
    public int GraceMinutes { get; init; } = 15;

    public decimal MotorcyclePerHour { get; init; } = 1.00m;
    public decimal CompactPerHour { get; init; } = 2.00m;
    public decimal StandardPerHour { get; init; } = 3.00m;
    public decimal EvPerHour { get; init; } = 3.50m;

    /// <summary>Maximum charge per 24h-period inside one stay.</summary>
    public decimal DailyCap { get; init; } = 20.00m;

    /// <summary>Flat fee replacing time-based fees for lost tickets.</summary>
    public decimal LostTicketFee { get; init; } = 25.00m;

    public decimal RateFor(VehicleType type) => type switch
    {
        VehicleType.Motorcycle => MotorcyclePerHour,
        VehicleType.Compact => CompactPerHour,
        VehicleType.Standard => StandardPerHour,
        VehicleType.Ev => EvPerHour,
        _ => 0m,
    };
}
