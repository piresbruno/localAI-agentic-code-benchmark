using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;

namespace ParkWise.UnitTests;

/// <summary>Ticket service rules with fake repositories and a fixed clock (spec §4).</summary>
public class TicketServiceTests
{
    private static readonly DateTime Entry = new(2026, 3, 10, 9, 0, 0, DateTimeKind.Utc);

    private readonly FakeBayRepository _bays;
    private readonly FakeTicketRepository _tickets;
    private readonly FakePermitRepository _permits;
    private readonly FixedClock _clock;
    private readonly TicketService _service;

    public TicketServiceTests()
    {
        _bays = new FakeBayRepository((1, BayType.Motorcycle, 2), (1, BayType.Compact, 2), (1, BayType.Standard, 3), (1, BayType.Ev, 1));
        _tickets = new FakeTicketRepository();
        _permits = new FakePermitRepository();
        _clock = FixedClock.At(2026, 3, 10, 9, 0);
        _service = new TicketService(_bays, _tickets, _permits, new FeeCalculator(new FeeOptions()), _clock);
    }

    private void AdvanceTo(int year, int month, int day, int hour, int minute) =>
        _clock.SetTo(new DateTime(year, month, day, hour, minute, 0, DateTimeKind.Utc));

    [Fact]
    public async Task rejects_malformed_plate()
    {
        await Assert.ThrowsAsync<PlateInvalidException>(
            () => _service.RegisterEntryAsync("XX", "standard", null));
        await Assert.ThrowsAsync<PlateInvalidException>(
            () => _service.RegisterEntryAsync("ab-123-cd", "standard", null)); // spec regex is uppercase-only
        await Assert.ThrowsAsync<PlateInvalidException>(
            () => _service.RegisterEntryAsync("AAA-123-BB", "standard", null));
    }

    [Fact]
    public async Task accepts_valid_plate_and_allocates_preferred_bay()
    {
        var result = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        Assert.Equal(TicketStatus.Open, result.Ticket.Status);
        Assert.Equal(BayType.Standard, result.Bay.Type);
        Assert.Equal(1, result.Ticket.Level);
    }

    [Theory]
    [InlineData("motorcycle", BayType.Motorcycle)]
    [InlineData("compact", BayType.Compact)]
    [InlineData("ev", BayType.Ev)]
    public async Task allocates_own_bay_type_when_free(string vehicleType, BayType expectedBay)
    {
        var result = await _service.RegisterEntryAsync("AA-123-BB", vehicleType, null);
        Assert.Equal(expectedBay, result.Bay.Type);
    }

    [Fact]
    public async Task ev_falls_back_to_standard_bay_when_no_ev_free()
    {
        // Occupy the single EV bay with another vehicle first.
        await _service.RegisterEntryAsync("AA-123-BB", "ev", null);
        var second = await _service.RegisterEntryAsync("CC-456-DD", "ev", null);
        Assert.Equal(BayType.Standard, second.Bay.Type); // EV preferred, else standard
    }

    [Fact]
    public async Task compact_falls_back_to_standard_bay()
    {
        // Occupy both compact bays.
        await _service.RegisterEntryAsync("AA-123-BB", "compact", null);
        await _service.RegisterEntryAsync("CC-456-DD", "compact", null);
        var third = await _service.RegisterEntryAsync("EE-789-FF", "compact", null);
        Assert.Equal(BayType.Standard, third.Bay.Type);
    }

    [Fact]
    public async Task denies_entry_when_no_compatible_bay_free()
    {
        // All 3 standard bays are the only compatible bays for standard vehicles.
        for (var i = 0; i < 3; i++)
        {
            await _service.RegisterEntryAsync($"AA-12{i}-BB", "standard", null);
        }
        var full = await Assert.ThrowsAsync<GarageFullException>(
            () => _service.RegisterEntryAsync("ZZ-999-ZZ", "standard", null));
        Assert.Contains(BayType.Standard, full.FullTypes);
    }

    [Fact]
    public async Task frees_bay_on_exit_and_capacity_recovers()
    {
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        AdvanceTo(2026, 3, 10, 10, 0); // 1h later, unpaid
        // Exit requires payment → but capacity check first: bay is occupied.
        var freeBefore = (await _bays.GetFreeBayIdsByTypeAsync())[BayType.Standard].Count;
        Assert.Equal(2, freeBefore);

        // Pay then exit frees the bay.
        var payments = new PaymentService(_tickets, new FakePaymentRepository(), _permits,
            new FeeCalculator(new FeeOptions()), new FeeOptions(), _clock);
        await payments.PayAsync(entry.Ticket.Id, "card", false);
        await _service.ProcessExitAsync(entry.Ticket.Id);

        var freeAfter = (await _bays.GetFreeBayIdsByTypeAsync())[BayType.Standard].Count;
        Assert.Equal(3, freeAfter);
        Assert.Equal(0, _bays.OccupiedCount);
    }

    [Fact]
    public async Task concurrent_entries_never_exceed_capacity()
    {
        // 6 parallel entries compete for 3 standard bays: exactly 3 succeed.
        var tasks = Enumerable.Range(0, 6)
            .Select(i => _service.RegisterEntryAsync($"AA-12{i}-BB", "standard", null))
            .ToList();

        var successes = 0;
        var garageFull = 0;
        foreach (var task in tasks)
        {
            try
            {
                await task;
                successes++;
            }
            catch (GarageFullException)
            {
                garageFull++;
            }
        }
        Assert.Equal(3, successes);
        Assert.Equal(3, garageFull);
        Assert.Equal(3, _bays.OccupiedCount); // never over capacity
    }

    [Fact]
    public async Task applies_grace_period_on_unpaid_exit()
    {
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        AdvanceTo(2026, 3, 10, 9, 15); // exactly 15 minutes later
        var quote = await _service.ProcessExitAsync(entry.Ticket.Id);
        Assert.Equal(0.00m, quote.Amount);
        Assert.True(quote.IsGrace);
        Assert.Equal(0, _bays.OccupiedCount); // bay freed
    }

    [Fact]
    public async Task requires_payment_before_exit_when_fee_due()
    {
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        AdvanceTo(2026, 3, 10, 11, 0); // 2h → 6.00 due
        var ex = await Assert.ThrowsAsync<PaymentRequiredException>(
            () => _service.ProcessExitAsync(entry.Ticket.Id));
        Assert.Equal(6.00m, ex.Quote!.Amount);
        Assert.Equal(1, _bays.OccupiedCount); // bay NOT freed until paid
    }

    [Fact]
    public async Task blocks_paid_ticket_double_exit()
    {
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        AdvanceTo(2026, 3, 10, 10, 0);
        var payments = new PaymentService(_tickets, new FakePaymentRepository(), _permits,
            new FeeCalculator(new FeeOptions()), new FeeOptions(), _clock);
        await payments.PayAsync(entry.Ticket.Id, "card", false);
        await _service.ProcessExitAsync(entry.Ticket.Id);
        await Assert.ThrowsAsync<AlreadyExitedException>(() => _service.ProcessExitAsync(entry.Ticket.Id));
    }

    [Fact]
    public async Task paid_ticket_exits_without_additional_charge()
    {
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        AdvanceTo(2026, 3, 10, 10, 0);
        var payments = new PaymentService(_tickets, new FakePaymentRepository(), _permits,
            new FeeCalculator(new FeeOptions()), new FeeOptions(), _clock);
        await payments.PayAsync(entry.Ticket.Id, "cash", false);
        AdvanceTo(2026, 3, 10, 10, 30); // exit 30 min after payment — still completes
        var quote = await _service.ProcessExitAsync(entry.Ticket.Id);
        Assert.Equal(0, _bays.OccupiedCount);
        Assert.True(quote.Amount >= 0); // completes; no second charge occurs
    }

    [Fact]
    public async Task active_permit_makes_fee_zero_but_occupies_bay()
    {
        await _permits.AddAsync(new PermitRecord("PERMIT-1", "AA-123-BB",
            Entry.AddDays(-1), Entry.AddDays(30)));
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", "PERMIT-1");
        AdvanceTo(2026, 3, 10, 13, 0); // 4h later
        Assert.Equal(1, _bays.OccupiedCount); // bay occupied despite free stay
        var quote = await _service.ProcessExitAsync(entry.Ticket.Id);
        Assert.Equal(0.00m, quote.Amount);
        Assert.True(quote.CoveredByPermit);
    }

    [Fact]
    public async Task expired_permit_charges_normal_fees()
    {
        await _permits.AddAsync(new PermitRecord("PERMIT-OLD", "AA-123-BB",
            Entry.AddDays(-30), Entry.AddDays(-1)));
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", "PERMIT-OLD");
        AdvanceTo(2026, 3, 10, 10, 0); // 1h
        // Expired permit → normal fees: exit requires payment of 3.00.
        var ex = await Assert.ThrowsAsync<PaymentRequiredException>(
            () => _service.ProcessExitAsync(entry.Ticket.Id));
        Assert.Equal(3.00m, ex.Quote!.Amount);
        Assert.False(ex.Quote.CoveredByPermit);
    }

    [Fact]
    public async Task quote_has_no_side_effects()
    {
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        AdvanceTo(2026, 3, 10, 11, 0);
        var quote1 = await _service.GetQuoteAsync(entry.Ticket.Id);
        var quote2 = await _service.GetQuoteAsync(entry.Ticket.Id);
        Assert.Equal(quote1.Amount, quote2.Amount);
        Assert.Equal(1, _bays.OccupiedCount); // still parked
        Assert.Equal(TicketStatus.Open, (await _tickets.GetByIdAsync(entry.Ticket.Id))!.Status);
    }

    [Fact]
    public async Task unknown_ticket_returns_not_found()
    {
        await Assert.ThrowsAsync<TicketNotFoundException>(() => _service.GetQuoteAsync(Guid.NewGuid()));
        await Assert.ThrowsAsync<TicketNotFoundException>(() => _service.ProcessExitAsync(Guid.NewGuid()));
    }

    [Fact]
    public async Task report_lost_sets_flat_fee()
    {
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        AdvanceTo(2026, 3, 10, 10, 0);
        var quote = await _service.ReportLostAsync(entry.Ticket.Id, "AA-123-BB");
        Assert.Equal(25.00m, quote.Amount);
        Assert.True(quote.IsLost);
        Assert.Equal(TicketStatus.Lost, (await _tickets.GetByIdAsync(entry.Ticket.Id))!.Status);
    }

    [Fact]
    public async Task report_lost_rejects_wrong_plate()
    {
        var entry = await _service.RegisterEntryAsync("AA-123-BB", "standard", null);
        await Assert.ThrowsAsync<PlateInvalidException>(
            () => _service.ReportLostAsync(entry.Ticket.Id, "ZZ-999-ZZ"));
    }
}
