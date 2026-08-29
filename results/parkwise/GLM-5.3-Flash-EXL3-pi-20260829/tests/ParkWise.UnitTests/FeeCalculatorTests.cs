using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;

namespace ParkWise.UnitTests;

/// <summary>Fee calculator matrix: minute boundaries, hour boundaries, multi-day, caps,
/// lost ticket (spec §7). All math decimal; rates: motorcycle 1.00, compact 2.00,
/// standard 3.00, ev 3.50; cap 20.00; lost 25.00.</summary>
public class FeeCalculatorTests
{
    private static readonly DateTime Entry = new(2026, 3, 10, 9, 0, 0, DateTimeKind.Utc);
    private readonly FeeCalculator _calculator = new(DefaultFees());

    private static FeeOptions DefaultFees() => new()
    {
        GraceMinutes = 15,
        MotorcycleRatePerHour = 1.00m,
        CompactRatePerHour = 2.00m,
        StandardRatePerHour = 3.00m,
        EvRatePerHour = 3.50m,
        DailyCap = 20.00m,
        EvChargingSurcharge = 2.50m,
        LostTicketFee = 25.00m,
    };

    private FeeQuote Quote(TimeSpan duration, VehicleType type = VehicleType.Standard, TicketStatus status = TicketStatus.Open) =>
        _calculator.Quote(
            new TicketRecord(Guid.NewGuid(), "AA-123-BB", type, Guid.NewGuid(), "Standard", 1,
                Entry, null, status, null, null),
            Entry + duration);

    [Fact]
    public void applies_grace_period_up_to_15_minutes()
    {
        Assert.Equal(0.00m, Quote(TimeSpan.FromMinutes(14)).Amount);
        Assert.True(Quote(TimeSpan.FromMinutes(14)).IsGrace);
    }

    [Fact]
    public void charges_from_15_minutes_01_second_onwards()
    {
        // 15:01 min → 1 started hour.
        Assert.Equal(0.00m, Quote(TimeSpan.FromMinutes(15)).Amount);
        Assert.True(Quote(TimeSpan.FromMinutes(15)).IsGrace);
        Assert.Equal(3.00m, Quote(TimeSpan.FromMinutes(15).Add(TimeSpan.FromSeconds(1))).Amount);
        Assert.False(Quote(TimeSpan.FromMinutes(15).Add(TimeSpan.FromSeconds(1))).IsGrace);
    }

    [Theory]
    [InlineData(0, 0.00)]      // within grace
    [InlineData(61, 6.00)]     // 1h01m → 2 started hours (any part-past hour bills)
    [InlineData(119, 6.00)]    // 1h59m → still 2 started hours
    [InlineData(121, 9.00)]    // 2h01m → 3 started hours
    [InlineData(240, 12.00)]   // 4h → 4 started hours
    public void charges_started_hours(int minutes, decimal expected)
    {
        Assert.Equal(expected, Quote(TimeSpan.FromMinutes(minutes)).Amount);
    }

    [Fact]
    public void charges_started_hours_up_to_daily_cap_20h_standard()
    {
        // 20h crosses midnight → capped per 24h period from entry: min(20 × 3, 20) = 20.00.
        Assert.Equal(20.00m, Quote(TimeSpan.FromHours(20)).Amount);
    }

    [Fact]
    public void same_day_stay_bills_started_hours_without_cap()
    {
        // 7h15m within one calendar day: 8 × 3.00 = 24.00 (no cap).
        Assert.Equal(24.00m, Quote(TimeSpan.FromHours(7).Add(TimeSpan.FromMinutes(15))).Amount);
    }

    [Fact]
    public void multi_day_stay_caps_each_24h_period()
    {
        // 30h stay: period 1 (24h) capped at 20.00 + period 2 (6h → 2 started hours... 6h→6h? started hours of remaining 6h = 6) —
        // raw total = 30 × 3 = 90; capped: min(90, 20 × 2) = 40.00.
        Assert.Equal(40.00m, Quote(TimeSpan.FromHours(30)).Amount);
    }

    [Fact]
    public void motorcycle_rate_is_one_euro()
    {
        Assert.Equal(2.00m, Quote(TimeSpan.FromMinutes(120), VehicleType.Motorcycle).Amount);
    }

    [Fact]
    public void ev_rate_is_three_fifty()
    {
        Assert.Equal(10.50m, Quote(TimeSpan.FromMinutes(180), VehicleType.Ev).Amount); // 3 × 3.50
    }

    [Fact]
    public void charges_flat_fee_for_lost_ticket()
    {
        var quote = Quote(TimeSpan.FromMinutes(5), status: TicketStatus.Lost);
        Assert.Equal(25.00m, quote.Amount);
        Assert.True(quote.IsLost);
    }

    [Fact]
    public void lost_ticket_flat_fee_ignores_duration()
    {
        // Even a 3-day stay with a lost ticket costs the flat fee.
        Assert.Equal(25.00m, Quote(TimeSpan.FromHours(72), status: TicketStatus.Lost).Amount);
    }

    [Fact]
    public void rates_are_config_driven()
    {
        var custom = new FeeCalculator(new FeeOptions { StandardRatePerHour = 4.50m, GraceMinutes = 15 });
        var quote = custom.Quote(
            new TicketRecord(Guid.NewGuid(), "AA-123-BB", VehicleType.Standard, Guid.NewGuid(), "Standard", 1,
                Entry, null, TicketStatus.Open, null, null),
            Entry.AddHours(2));
        Assert.Equal(9.00m, quote.Amount);
    }

    [Fact]
    public void rounding_is_away_from_zero_at_final_step()
    {
        // Rate 3.00 with 1 started hour is exact; use a config producing a fractional sum
        // that lands on a half-cent: rate 3.335/hour × 3 hours = 10.005 → 10.01 (away from zero).
        var calc = new FeeCalculator(new FeeOptions { StandardRatePerHour = 3.335m });
        var quote = calc.Quote(
            new TicketRecord(Guid.NewGuid(), "AA-123-BB", VehicleType.Standard, Guid.NewGuid(), "Standard", 1,
                Entry, null, TicketStatus.Open, null, null),
            Entry.AddHours(3));
        Assert.Equal(10.01m, quote.Amount);
    }
}
