using Xunit;
using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Services.Domain;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;
using static ParkWise.UnitTests.TestClock;

namespace ParkWise.UnitTests;

/// <summary>
/// §4 named business rules at service level, with in-memory fakes and a fixed IClock.
/// </summary>
public sealed class ParkingServiceTests : IDisposable
{
    private readonly FakeTicketRepository _tickets = new();
    private readonly FakePaymentRepository _payments = new();
    private readonly SemaphoreSlim _lock = new(1, 1);
    private readonly ParkingService _svc;

    public ParkingServiceTests()
    {
        _svc = MakeService(new TestClock(T0));
    }

    public void Dispose() => _lock.Dispose();

    private ParkingService MakeService(IClock clock) =>
        new(_tickets, _payments, new FeeCalculator(new FeeOptions()),
            new GarageOptions { MotorcycleBays = 2, CompactBays = 3, StandardBays = 5, EvBays = 1 },
            clock, _lock);

    [Fact]
    public async Task Rejects_Malformed_Plate_With_422()
    {
        var ex = await Assert.ThrowsAsync<AppException>(() => _svc.RegisterEntryAsync("abc-123", VehicleType.Standard));
        Assert.Equal(ErrorCodes.PlateInvalid, ex.Code);
        Assert.Equal(422, ex.StatusCode);
        // correct format accepted (case-normalized)
        var ticket = await _svc.RegisterEntryAsync("ab-123-cd", VehicleType.Standard);
        Assert.Equal("AB-123-CD", ticket.Plate);
    }

    [Fact]
    public async Task Denies_Entry_When_No_Compatible_Bay_Free_With_Full_Types_In_Details()
    {
        for (var i = 0; i < 5; i++) await _svc.RegisterEntryAsync($"AB-00{i}-CD", VehicleType.Standard);
        var ex = await Assert.ThrowsAsync<AppException>(() => _svc.RegisterEntryAsync("AB-999-CD", VehicleType.Standard));
        Assert.Equal(ErrorCodes.GarageFull, ex.Code);
        Assert.Equal(409, ex.StatusCode);
        var fullTypes = Assert.IsType<string[]>(((IReadOnlyDictionary<string, object?>)ex.Details!)["fullTypes"]);
        Assert.Equal(["Standard"], fullTypes);
    }

    [Fact]
    public async Task Frees_Bay_On_Exit_Capacity_Must_Recover()
    {
        // fill all standard bays
        var list = new List<TicketDto>();
        for (var i = 0; i < 5; i++) list.Add(await _svc.RegisterEntryAsync($"AB-00{i}-CD", VehicleType.Standard));

        await Assert.ThrowsAsync<AppException>(() => _svc.RegisterEntryAsync("AB-999-CD", VehicleType.Standard));

        // one exits (within grace) → bay freed → entry succeeds again
        await _svc.RequestExitAsync(list[0].Id);
        var reentry = await _svc.RegisterEntryAsync("AB-999-CD", VehicleType.Standard);
        Assert.Equal(list[0].BayId, reentry.BayId); // lowest free bay number reused
    }

    [Fact]
    public async Task Applies_Grace_Period_On_Unpaid_Exit_Auto_Completes_With_Zero_Fee()
    {
        var ticket = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Standard);
        var clockAware = MakeService(new TestClock(T0.AddMinutes(10)));
        var result = await clockAware.RequestExitAsync(ticket.Id);
        Assert.Equal(0m, result.FeeCollected);
        Assert.Equal(TicketStatus.Exited, result.Ticket.Status);
    }

    [Fact]
    public async Task Blocks_Paid_Ticket_Double_Exit_With_409()
    {
        var ticket = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Standard);
        var clockAware = WithClock(T0.AddHours(2));
        await clockAware.PayAsync(ticket.Id, PaymentMethod.Card);
        await clockAware.RequestExitAsync(ticket.Id);
        var ex = await Assert.ThrowsAsync<AppException>(() => clockAware.RequestExitAsync(ticket.Id));
        Assert.Equal(ErrorCodes.AlreadyExited, ex.Code);
        Assert.Equal(409, ex.StatusCode);
    }

    [Fact]
    public async Task Requires_Payment_Before_Exit_When_Fee_Due_With_Quote_In_Details()
    {
        var ticket = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Standard);
        var clockAware = WithClock(T0.AddHours(2)); // 2 started hours standard = 6.00
        var ex = await Assert.ThrowsAsync<AppException>(() => clockAware.RequestExitAsync(ticket.Id));
        Assert.Equal(ErrorCodes.PaymentRequired, ex.Code);
        Assert.Equal(402, ex.StatusCode);
        var details = (IReadOnlyDictionary<string, object?>)ex.Details!;
        Assert.Equal(6.00m, details["fee"]);
        Assert.Equal("EUR", details["currency"]);
    }

    [Fact]
    public async Task Payment_Marks_Ticket_Paid_And_Returns_Receipt()
    {
        var ticket = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Ev);
        var clockAware = WithClock(T0.AddHours(1)); // ev 1 started hour = 3.50
        var receipt = await clockAware.PayAsync(ticket.Id, PaymentMethod.Card);
        Assert.Equal(3.50m, receipt.Amount);
        var stored = await _tickets.FindByIdAsync(Guid.Parse(ticket.Id));
        Assert.Equal(TicketStatus.Paid, stored!.Status);
        var fetched = await clockAware.GetPaymentAsync(receipt.Id);
        Assert.Equal(receipt.Id, fetched.Id);
    }

    [Fact]
    public async Task Double_Payment_Is_Rejected()
    {
        var ticket = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Standard);
        var clockAware = WithClock(T0.AddHours(1));
        await clockAware.PayAsync(ticket.Id, PaymentMethod.Cash);
        var ex = await Assert.ThrowsAsync<AppException>(() => clockAware.PayAsync(ticket.Id, PaymentMethod.Cash));
        Assert.Equal(ErrorCodes.TicketAlreadyPaid, ex.Code);
    }

    [Fact]
    public async Task Charges_Flat_Fee_For_Lost_Ticket_End_To_End()
    {
        var ticket = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Motorcycle);
        var clockAware = WithClock(T0.AddHours(5));
        await clockAware.MarkLostAsync(ticket.Id);
        var dto = await clockAware.GetTicketAsync(ticket.Id);
        Assert.Equal(TicketStatus.Lost, dto.Status);
        Assert.Equal(25.00m, dto.CurrentFee); // flat fee replaces time-based fee
        var receipt = await clockAware.PayAsync(ticket.Id, PaymentMethod.App);
        Assert.Equal(25.00m, receipt.Amount);
        var exit = await clockAware.RequestExitAsync(ticket.Id);
        Assert.Equal(25.00m, exit.FeeCollected);
    }

    [Fact]
    public async Task Ev_Prefers_Ev_Bay_Then_Falls_Back_To_Standard()
    {
        var ev1 = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Ev);
        Assert.StartsWith("E-", ev1.BayId);
        var ev2 = await _svc.RegisterEntryAsync("EF-456-GH", VehicleType.Ev); // ev pool exhausted (1 bay)
        Assert.StartsWith("S-", ev2.BayId); // falls back to standard
    }

    [Fact]
    public async Task Motorcycle_Takes_Motorcycle_Bay_First_And_Can_Use_Any_Bay()
    {
        var m1 = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Motorcycle);
        Assert.StartsWith("M-", m1.BayId);
        var m2 = await _svc.RegisterEntryAsync("EF-456-GH", VehicleType.Motorcycle);
        Assert.StartsWith("M-", m2.BayId);
        var m3 = await _svc.RegisterEntryAsync("IJ-789-KL", VehicleType.Motorcycle); // motorcycles full → compact
        Assert.StartsWith("C-", m3.BayId);
    }

    [Fact]
    public async Task Compact_Falls_Back_To_Standard_When_Compact_Full()
    {
        for (var i = 0; i < 3; i++) await _svc.RegisterEntryAsync($"AB-00{i}-CD", VehicleType.Compact);
        var overflow = await _svc.RegisterEntryAsync("XY-998-ZZ", VehicleType.Compact);
        Assert.StartsWith("S-", overflow.BayId);
    }

    [Fact]
    public async Task Unknown_Ticket_Ids_Return_TicketNotFound()
    {
        var ex = await Assert.ThrowsAsync<AppException>(() => _svc.GetTicketAsync("not-a-guid"));
        Assert.Equal(ErrorCodes.TicketNotFound, ex.Code);
        var ex2 = await Assert.ThrowsAsync<AppException>(() => _svc.GetTicketAsync(Guid.NewGuid().ToString()));
        Assert.Equal(ErrorCodes.TicketNotFound, ex2.Code);
    }

    [Fact]
    public async Task GetOccupancy_Reports_Used_And_Total_Per_Type()
    {
        await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Motorcycle);
        await _svc.RegisterEntryAsync("EF-456-GH", VehicleType.Ev);
        await _svc.RegisterEntryAsync("IJ-789-KL", VehicleType.Ev); // falls back to standard
        var occupancy = await _svc.GetOccupancyAsync();
        Assert.Equal(1, occupancy.First(o => o.Type == VehicleType.Motorcycle).Used);
        Assert.Equal(2, occupancy.First(o => o.Type == VehicleType.Motorcycle).Total);
        Assert.Equal(1, occupancy.First(o => o.Type == VehicleType.Ev).Used);
        Assert.Equal(1, occupancy.First(o => o.Type == VehicleType.Ev).Total);
        Assert.Equal(1, occupancy.First(o => o.Type == VehicleType.Standard).Used);
        Assert.Equal(5, occupancy.First(o => o.Type == VehicleType.Standard).Total);
    }

    [Fact]
    public async Task Concurrent_Entries_Never_Exceed_Capacity()
    {
        // 5 standard bays; fire 12 parallel standard entries — exactly 5 must succeed.
        var tasks = Enumerable.Range(0, 12)
            .Select(i => Task.Run(async () =>
            {
                try
                {
                    return await _svc.RegisterEntryAsync($"AB-{i:000}-CD", VehicleType.Standard);
                }
                catch (AppException)
                {
                    return null;
                }
            }))
            .ToList();
        var results = await Task.WhenAll(tasks);
        Assert.Equal(5, results.Count(t => t is not null));
        Assert.Equal(7, results.Count(t => t is null));

        var occupancy = await _svc.GetOccupancyAsync();
        Assert.Equal(5, occupancy.First(o => o.Type == VehicleType.Standard).Used);
    }

    [Fact]
    public async Task Live_Fee_Quote_Grows_With_Elapsed_Time()
    {
        var ticket = await _svc.RegisterEntryAsync("AB-123-CD", VehicleType.Standard);
        Assert.Equal(0m, ticket.CurrentFee); // within grace at entry
        var later = WithClock(T0.AddHours(3));
        var dto = await later.GetTicketAsync(ticket.Id);
        Assert.Equal(9.00m, dto.CurrentFee); // 3 started hours standard
    }

    private ParkingService WithClock(DateTime at) => MakeService(new TestClock(at));
}
