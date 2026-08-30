using Xunit;
using ParkWise.Services;

namespace ParkWise.UnitTests;

public class SmokeTests
{
    private sealed class FixedClock(DateTime now) : IClock
    {
        public DateTime UtcNow { get; } = now;
    }

    [Fact]
    public void fixed_clock_serves_injected_time()
    {
        var at = new DateTime(2026, 3, 1, 10, 0, 0, DateTimeKind.Utc);
        Assert.Equal(at, new FixedClock(at).UtcNow);
    }
}
