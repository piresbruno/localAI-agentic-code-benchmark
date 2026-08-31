using ParkWise.Contracts;
using ParkWise.Services.Domain;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;

namespace ParkWise.Services;

/// <summary>
/// Bay allocation + ticket lifecycle. Capacity is protected by a singleton async semaphore:
/// bay allocate/free run one-at-a-time in-process, so parallel entries can never exceed the
/// configured pool (spec §4 `frees_bay_on_exit` under parallel load). A multi-instance
/// deployment would need DB-level locking — see docs/DECISIONS.md.
/// </summary>
public sealed class ParkingService(
    ITicketRepository tickets,
    IPaymentRepository payments,
    IFeeCalculator fees,
    GarageOptions garage,
    IClock clock,
    SemaphoreSlim capacityLock) : IParkingService
{
    public const string Currency = "EUR";

    public ParkingService(ITicketRepository tickets, IPaymentRepository payments, IFeeCalculator fees, GarageOptions garage, IClock clock)
        : this(tickets, payments, fees, garage, clock, new SemaphoreSlim(1, 1)) { }

    /// <summary>Own/smallest fitting bay type first: motorcycle → any; compact → compact/standard;
    /// standard → standard; ev → ev preferred, else standard (spec §4).</summary>
    public static readonly IReadOnlyList<VehicleType>[] BayPreference =
    [
        [VehicleType.Motorcycle, VehicleType.Compact, VehicleType.Standard],
        [VehicleType.Compact, VehicleType.Standard],
        [VehicleType.Standard],
        [VehicleType.Ev, VehicleType.Standard],
    ];

    public static IReadOnlyList<VehicleType> CompatibleBays(VehicleType vehicleType) => BayPreference[(int)vehicleType];

    public async Task<TicketDto> RegisterEntryAsync(string plate, VehicleType vehicleType, CancellationToken ct = default)
    {
        await capacityLock.WaitAsync(ct);
        try
        {
            var active = await tickets.ListActiveAsync(ct);
            var usedPerType = active.GroupBy(t => t.BayType).ToDictionary(g => g.Key, g => g.Select(t => ParseBayNumber(g.Key, t.BayId)).ToHashSet());

            var compatible = CompatibleBays(vehicleType);
            var fullTypes = compatible.Where(t => (usedPerType.GetValueOrDefault(t) ?? []).Count >= garage.Total(t)).ToList();

            VehicleType? chosen = null;
            foreach (var type in compatible)
            {
                var used = usedPerType.GetValueOrDefault(type) ?? [];
                if (used.Count < garage.Total(type)) { chosen = type; break; }
            }
            if (chosen is null)
            {
                throw new AppException(
                    ErrorCodes.GarageFull, 409,
                    "The garage is full for this vehicle type.",
                    new Dictionary<string, object?> { ["fullTypes"] = fullTypes.Select(t => t.ToString()).ToArray() });
            }

            var usedNumbers = usedPerType.GetValueOrDefault(chosen.Value) ?? [];
            int number = 1;
            while (usedNumbers.Contains(number)) number++;
            var bayId = $"{BayLetter(chosen.Value)}-{number}";

            var ticket = Ticket.Create(plate, vehicleType, bayId, chosen.Value, clock.UtcNow);
            await tickets.AddAsync(ticket, ct);
            return ToDto(ticket);
        }
        finally
        {
            capacityLock.Release();
        }
    }

    public async Task<IReadOnlyList<TicketDto>> ListTicketsAsync(TicketStatus? status, CancellationToken ct = default)
    {
        var list = await tickets.ListByStatusAsync(status, ct);
        return list.Select(ToDto).ToList();
    }

    public async Task<TicketDto> GetTicketAsync(string ticketId, CancellationToken ct = default)
    {
        var ticket = await FindTicketAsync(ticketId, ct);
        return ToDto(ticket);
    }

    /// <summary>
    /// Exit semantics (spec §4): within grace → fee 0, auto-complete; paid → complete;
    /// otherwise 402 PAYMENT_REQUIRED carrying the live fee quote.
    /// </summary>
    public async Task<ExitResult> RequestExitAsync(string ticketId, CancellationToken ct = default)
    {
        await capacityLock.WaitAsync(ct);
        try
        {
            var ticket = await FindTicketAsync(ticketId, ct);
            if (ticket.Status == TicketStatus.Exited)
            {
                throw new AppException(ErrorCodes.AlreadyExited, 409, "This ticket has already exited.");
            }
            var quote = fees.Calculate(ticket.EntryAtUtc, clock.UtcNow, ticket.VehicleType, ticket.Status == TicketStatus.Lost);

            if (ticket.Status == TicketStatus.Paid)
            {
                var receipt = await payments.FindByTicketIdAsync(ticket.Id, ct);
                ticket.MarkExited();
                await tickets.UpdateAsync(ticket, ct);
                return new ExitResult(ToDto(ticket), receipt?.Amount ?? 0m, receipt?.Id.ToString());
            }
            if (quote == 0m) // applies_grace_period_on_unpaid_exit
            {
                ticket.MarkExited();
                await tickets.UpdateAsync(ticket, ct);
                return new ExitResult(ToDto(ticket), 0m, null);
            }
            throw new AppException(
                ErrorCodes.PaymentRequired, 402,
                "Payment required before exit.",
                new Dictionary<string, object?> { ["fee"] = quote, ["currency"] = Currency });
        }
        finally
        {
            capacityLock.Release();
        }
    }

    public async Task<PaymentDto> PayAsync(string ticketId, PaymentMethod method, CancellationToken ct = default)
    {
        await capacityLock.WaitAsync(ct);
        try
        {
            var ticket = await FindTicketAsync(ticketId, ct);
            var amount = fees.Calculate(ticket.EntryAtUtc, clock.UtcNow, ticket.VehicleType, ticket.Status == TicketStatus.Lost);
            var receipt = ticket.MarkPaid(amount, method, clock.UtcNow); // guards double payment + exited
            await payments.AddAsync(receipt, ct);
            await tickets.UpdateAsync(ticket, ct);
            return ToDto(receipt);
        }
        finally
        {
            capacityLock.Release();
        }
    }

    public async Task<PaymentDto> GetPaymentAsync(string paymentId, CancellationToken ct = default)
    {
        if (!Guid.TryParse(paymentId, out var id)) throw AppException.NotFound("Payment");
        var receipt = await payments.FindByIdAsync(id, ct) ?? throw AppException.NotFound("Payment");
        return ToDto(receipt);
    }

    public async Task<TicketDto> MarkLostAsync(string ticketId, CancellationToken ct = default)
    {
        var ticket = await FindTicketAsync(ticketId, ct);
        ticket.MarkLost();
        await tickets.UpdateAsync(ticket, ct);
        return ToDto(ticket);
    }

    public async Task<IReadOnlyList<OccupancyItem>> GetOccupancyAsync(CancellationToken ct = default)
    {
        var active = await tickets.ListActiveAsync(ct);
        var used = active.GroupBy(t => t.BayType).ToDictionary(g => g.Key, g => g.Count());
        return Enum.GetValues<VehicleType>()
            .Select(t => new OccupancyItem(t, used.GetValueOrDefault(t), garage.Total(t)))
            .ToList();
    }

    /// <summary>frees_bay_on_exit: exited tickets leave the active set, so capacity recovers.</summary>
    private async Task<Ticket> FindTicketAsync(string ticketId, CancellationToken ct)
    {
        if (!Guid.TryParse(ticketId, out var id))
        {
            throw new AppException(ErrorCodes.TicketNotFound, 404, "Ticket not found.");
        }
        return await tickets.FindByIdAsync(id, ct)
               ?? throw new AppException(ErrorCodes.TicketNotFound, 404, "Ticket not found.");
    }

    private TicketDto ToDto(Ticket ticket) => new(
        ticket.Id.ToString(),
        ticket.Plate,
        ticket.VehicleType,
        ticket.BayId,
        ticket.EntryAtUtc,
        ticket.Status,
        fees.Calculate(ticket.EntryAtUtc, clock.UtcNow, ticket.VehicleType, ticket.Status == TicketStatus.Lost),
        Currency);

    private static PaymentDto ToDto(PaymentReceipt r) => new(r.Id.ToString(), r.TicketId.ToString(), r.Amount, r.Method, r.PaidAtUtc);

    private static char BayLetter(VehicleType type) => type switch
    {
        VehicleType.Motorcycle => 'M',
        VehicleType.Compact => 'C',
        VehicleType.Standard => 'S',
        VehicleType.Ev => 'E',
        _ => '?',
    };

    private static int ParseBayNumber(VehicleType type, string bayId) =>
        int.TryParse(bayId.Split('-')[1], out var n) ? n : 0;
}
