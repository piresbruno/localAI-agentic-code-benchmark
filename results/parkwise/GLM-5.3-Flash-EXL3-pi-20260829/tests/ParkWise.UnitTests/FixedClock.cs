using ParkWise.Services.Abstractions;

namespace ParkWise.UnitTests;

/// <summary>Fixed injected clock — no DateTime.Now anywhere in tests (spec §7).</summary>
public sealed class FixedClock(DateTime utcNow) : IClock
{
    public DateTime UtcNow => utcNow;

    public void SetTo(DateTime value) => utcNow = value;

    public static FixedClock At(int year, int month, int day, int hour = 0, int minute = 0) =>
        new(new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Utc));
}
