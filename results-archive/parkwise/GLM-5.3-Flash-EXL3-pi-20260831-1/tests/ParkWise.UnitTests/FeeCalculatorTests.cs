using Xunit;
using ParkWise.Contracts;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;
using static ParkWise.UnitTests.TestClock;

namespace ParkWise.UnitTests;

/// <summary>Fee calculator matrix (spec §8) — minute boundaries, hour boundaries, caps, multi-day, lost.</summary>
public class FeeCalculatorTests
{
    private static FeeCalculator Create() => new(new FeeOptions());

    [Theory]
    [InlineData(14, 0.0)] // within grace → free
    [InlineData(15, 0.0)] // exactly 15 min → still free ("≤ 15 min")
    [InlineData(16, 3.0)] // 1 started hour, standard rate
    [InlineData(59, 3.0)] // 1 started hour
    [InlineData(60, 3.0)] // exactly 1h = 1 started hour
    [InlineData(61, 6.0)] // 2 started hours
    [InlineData(435, 20.0)] // 7h15m standard = 8 × 3.00 = 24.00 → capped by the 20.00 daily cap
    public void Charges_Started_Hours_With_Minute_Boundaries(int minutes, decimal expected)
    {
        var fee = Create().Calculate(T0, T0.AddMinutes(minutes), VehicleType.Standard, lost: false);
        Assert.Equal(expected, fee);
    }

    [Fact]
    public void Charges_Started_Hours_Up_To_Daily_Cap_20h_Standard()
    {
        // 20h standard = 20 × 3.00 = 60.00 → daily cap kicks in → 20.00 (spec example)
        var fee = Create().Calculate(T0, T0.AddHours(20), VehicleType.Standard, lost: false);
        Assert.Equal(20.00m, fee);
    }

    [Fact]
    public void Applies_Per_Type_Rates()
    {
        var calc = Create();
        Assert.Equal(2.00m, calc.Calculate(T0, T0.AddMinutes(90), VehicleType.Motorcycle, false)); // 2 × 1.00
        Assert.Equal(4.00m, calc.Calculate(T0, T0.AddMinutes(90), VehicleType.Compact, false)); // 2 × 2.00
        Assert.Equal(6.00m, calc.Calculate(T0, T0.AddMinutes(90), VehicleType.Standard, false)); // 2 × 3.00
        Assert.Equal(7.00m, calc.Calculate(T0, T0.AddMinutes(90), VehicleType.Ev, false)); // 2 × 3.50
    }

    [Fact]
    public void Caps_Each_24h_Period_Separately_On_Multi_Day_Stays()
    {
        // 30h standard: period 1 (24h) → 72.00 → cap 20.00; period 2 (6h) → 6 × 3.00 = 18.00 → total 38.00
        var fee = Create().Calculate(T0, T0.AddHours(30), VehicleType.Standard, lost: false);
        Assert.Equal(38.00m, fee);
    }

    [Fact]
    public void Charges_Flat_Fee_For_Lost_Ticket_Regardless_Of_Duration()
    {
        var calc = Create();
        Assert.Equal(25.00m, calc.Calculate(T0, T0.AddMinutes(10), VehicleType.Standard, lost: true));
        Assert.Equal(25.00m, calc.Calculate(T0, T0.AddHours(48), VehicleType.Motorcycle, lost: true));
    }

    [Fact]
    public void Zero_Duration_Or_Inverted_Range_Is_Free()
    {
        var calc = Create();
        Assert.Equal(0m, calc.Calculate(T0, T0, VehicleType.Standard, false));
        Assert.Equal(0m, calc.Calculate(T0, T0.AddMinutes(-5), VehicleType.Standard, false));
    }

    [Fact]
    public void Within_Grace_Matches_The_15_Minute_Boundary()
    {
        var calc = Create();
        Assert.True(calc.WithinGrace(T0, T0.AddMinutes(15)));
        Assert.False(calc.WithinGrace(T0, T0.AddMinutes(15).AddSeconds(1)));
    }
}
