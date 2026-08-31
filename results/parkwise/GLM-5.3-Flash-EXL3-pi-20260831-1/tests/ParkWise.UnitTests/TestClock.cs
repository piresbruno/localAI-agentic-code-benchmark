using ParkWise.Services;

namespace ParkWise.UnitTests;

/// <summary>Fixed clock for deterministic tests — no DateTime.Now anywhere in tests (spec §8).</summary>
public sealed class TestClock(DateTime utcNow) : IClock
{
    public DateTime UtcNow { get; } = utcNow;

    /// <summary>Fixture instant: a Wednesday 10:00 UTC.</summary>
    public static DateTime T0 => new(2026, 9, 2, 10, 0, 0, DateTimeKind.Utc);
}
