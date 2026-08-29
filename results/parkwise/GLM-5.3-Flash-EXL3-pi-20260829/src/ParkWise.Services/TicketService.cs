using ParkWise.Contracts;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Fees;

namespace ParkWise.Services;

/// <summary>Result of a successful entry.</summary>
public record EntryResult(TicketRecord Ticket, BaySnapshot Bay);

/// <summary>Entry/exit/quote business rules for tickets.</summary>
public class TicketService
{
    private readonly IBayRepository _bays;
    private readonly ITicketRepository _tickets;
    private readonly IPermitRepository _permits;
    private readonly IFeeCalculator _fees;
    private readonly IClock _clock;

    /// <summary>Plate format enforced at entry: AA-999-AA (uppercase).</summary>
    public static readonly System.Text.RegularExpressions.Regex PlateRegex =
        new("^[A-Z]{2}-\\d{3}-[A-Z]{2}$", System.Text.RegularExpressions.RegexOptions.Compiled);

    /// <summary>Which bay types can host each vehicle type, in preference order.</summary>
    private static readonly Dictionary<VehicleType, BayType[]> Compatibility = new()
    {
        [VehicleType.Motorcycle] = [BayType.Motorcycle, BayType.Compact, BayType.Standard, BayType.Ev],
        [VehicleType.Compact] = [BayType.Compact, BayType.Standard],
        [VehicleType.Standard] = [BayType.Standard],
        [VehicleType.Ev] = [BayType.Ev, BayType.Standard],
    };

    public TicketService(
        IBayRepository bays,
        ITicketRepository tickets,
        IPermitRepository permits,
        IFeeCalculator fees,
        IClock clock)
    {
        _bays = bays;
        _tickets = tickets;
        _permits = permits;
        _fees = fees;
        _clock = clock;
    }

    /// <summary>Registers a vehicle entry, allocating a compatible free bay. Race-safe under
    /// concurrent entries: allocation uses a conditional update, so a bay is never
    /// double-booked and capacity can never be exceeded.</summary>
    public async Task<EntryResult> RegisterEntryAsync(string plate, string vehicleType, string? permitCode, CancellationToken ct = default)
    {
        plate = plate?.Trim() ?? string.Empty;
        if (!PlateRegex.IsMatch(plate))
        {
            throw new PlateInvalidException(plate);
        }
        if (!Enum.TryParse<VehicleType>(vehicleType, ignoreCase: true, out var type))
        {
            throw new VehicleTypeInvalidException(vehicleType ?? string.Empty);
        }

        // Validate permit up front (if presented); an invalid code is ignored for fees
        // but stored so attendants can see it. Expired permits bill normally.
        if (permitCode is not null)
        {
            var permit = await _permits.GetByCodeAsync(permitCode, ct)
                ?? throw new PermitNotFoundException(permitCode);
            if (!string.Equals(permit.Plate, plate, StringComparison.OrdinalIgnoreCase))
            {
                throw new PermitNotFoundException(permitCode);
            }
        }

        var freeBays = await _bays.GetFreeBayIdsByTypeAsync(ct);
        foreach (var candidateType in Compatibility[type])
        {
            if (!freeBays.TryGetValue(candidateType, out var candidates) || candidates.Count == 0)
            {
                continue;
            }

            var ticketId = Guid.NewGuid();
            foreach (var bayId in candidates)
            {
                if (await _bays.TryOccupyAsync(bayId, ticketId, ct))
                {
                    var bay = await _bays.GetBayByIdAsync(bayId, ct)
                        ?? new BaySnapshot(bayId, 0, candidateType, true, ticketId);
                    var ticket = new TicketRecord(
                        ticketId, plate, type, bayId, bay.Type.ToString(),
                        Level: bay.Level, _clock.UtcNow, ExitAtUtc: null, TicketStatus.Open, permitCode, ReportedLostAtUtc: null);
                    await _tickets.AddAsync(ticket, ct);
                    return new EntryResult(ticket, bay);
                }
                // Lost the race for this bay; try the next candidate.
            }
        }

        var fullTypes = Compatibility[type].Where(t => !freeBays.TryGetValue(t, out var list) || list.Count == 0);
        throw new GarageFullException(fullTypes.ToList());
    }

    /// <summary>Current fee preview — no side effects.</summary>
    public async Task<QuoteResponse> GetQuoteAsync(Guid ticketId, CancellationToken ct = default)
    {
        var ticket = await _tickets.GetByIdAsync(ticketId, ct)
            ?? throw new TicketNotFoundException(ticketId);
        return await BuildQuoteAsync(ticket, ct);
    }

    /// <summary>Fetches one ticket (404 when unknown).</summary>
    public async Task<TicketRecord> GetTicketAsync(Guid ticketId, CancellationToken ct = default)
    {
        return await _tickets.GetByIdAsync(ticketId, ct)
            ?? throw new TicketNotFoundException(ticketId);
    }

    /// <summary>Processes an exit. Semantics (spec §4):
    /// - already exited → 409 ALREADY_EXITED;
    /// - within grace or covered by an active permit or already paid → complete, fee 0;
    /// - unpaid with fee due → 402 PAYMENT_REQUIRED carrying the quote;
    /// - lost tickets must be paid (flat fee) before exit.
    /// Exiting always frees the bay.</summary>
    public async Task<QuoteResponse> ProcessExitAsync(Guid ticketId, CancellationToken ct = default)
    {
        var ticket = await _tickets.GetByIdAsync(ticketId, ct)
            ?? throw new TicketNotFoundException(ticketId);

        if (ticket.Status == TicketStatus.Exited)
        {
            throw new AlreadyExitedException(ticketId);
        }

        var now = _clock.UtcNow;
        var quote = await BuildQuoteAsync(ticket, ct);

        if (quote.Amount > 0 && ticket.Status != TicketStatus.Paid)
        {
            throw new PaymentRequiredException(quote);
        }

        await CompleteExitAsync(ticket, now, ct);
        return quote;
    }

    /// <summary>Reports a physical ticket as lost: the stay is then settled at the flat fee.</summary>
    public async Task<QuoteResponse> ReportLostAsync(Guid ticketId, string plate, CancellationToken ct = default)
    {
        var ticket = await _tickets.GetByIdAsync(ticketId, ct)
            ?? throw new TicketNotFoundException(ticketId);
        if (ticket.Status == TicketStatus.Exited)
        {
            throw new AlreadyExitedException(ticketId);
        }
        if (!string.Equals(ticket.Plate, plate?.Trim().ToUpperInvariant(), StringComparison.OrdinalIgnoreCase))
        {
            throw new PlateInvalidException(plate ?? string.Empty);
        }

        var lost = ticket with { Status = TicketStatus.Lost, ReportedLostAtUtc = _clock.UtcNow };
        await _tickets.UpdateAsync(lost, ct);
        return await BuildQuoteAsync(lost, ct);
    }

    /// <summary>Builds the quote for a ticket, applying permit coverage on top of the fee.</summary>
    private async Task<QuoteResponse> BuildQuoteAsync(TicketRecord ticket, CancellationToken ct)
    {
        var now = _clock.UtcNow;
        var quote = _fees.Quote(ticket, now);

        bool coveredByPermit = false;
        if (!quote.IsLost && quote.Amount > 0 && ticket.PermitCode is not null)
        {
            var permit = await _permits.GetByCodeAsync(ticket.PermitCode, ct);
            if (permit is not null && permit.ValidFromUtc <= now && now <= permit.ValidUntilUtc)
            {
                coveredByPermit = true;
                quote = quote with { Amount = 0.00m, CoveredByPermit = true };
            }
        }

        _ = ct;
        return new QuoteResponse(
            quote.TicketId, quote.Plate, quote.VehicleType.ToString(),
            quote.EntryAtUtc, quote.QuotedAtUtc,
            quote.Amount, quote.IsGrace, coveredByPermit || quote.CoveredByPermit, quote.IsLost,
            quote.StartedHours, quote.RatePerHour, quote.Currency);
    }

    private async Task CompleteExitAsync(TicketRecord ticket, DateTime now, CancellationToken ct)
    {
        var exited = ticket with { Status = TicketStatus.Exited, ExitAtUtc = now };
        await _tickets.UpdateAsync(exited, ct);
        await _bays.FreeAsync(ticket.BayId, ct);
    }
}
