using ParkWise.Contracts;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;

namespace ParkWise.Services;

/// <summary>Payment business rules: settle tickets, refunds within the configured window.</summary>
public class PaymentService
{
    private readonly ITicketRepository _tickets;
    private readonly IPaymentRepository _payments;
    private readonly IPermitRepository _permits;
    private readonly IFeeCalculator _fees;
    private readonly FeeOptions _feeOptions;
    private readonly IClock _clock;

    public PaymentService(
        ITicketRepository tickets,
        IPaymentRepository payments,
        IPermitRepository permits,
        IFeeCalculator fees,
        FeeOptions feeOptions,
        IClock clock)
    {
        _tickets = tickets;
        _payments = payments;
        _permits = permits;
        _fees = fees;
        _feeOptions = feeOptions;
        _clock = clock;
    }

    /// <summary>Settles a ticket: computes the fee (permit-aware), adds the EV charging
    /// surcharge when requested, marks the ticket paid, and returns the receipt.
    /// Paying an open ticket double-charges is prevented: an already-paid ticket
    /// returns 409 via TicketNotOpenException.</summary>
    public async Task<PaymentRecord> PayAsync(Guid ticketId, string method, bool evChargingUsed, CancellationToken ct = default)
    {
        if (!Enum.TryParse<PaymentMethod>(method, ignoreCase: true, out var paymentMethod))
        {
            throw new PaymentMethodInvalidException(method ?? string.Empty);
        }

        var ticket = await _tickets.GetByIdAsync(ticketId, ct)
            ?? throw new TicketNotFoundException(ticketId);
        if (ticket.Status is TicketStatus.Paid or TicketStatus.Exited)
        {
            throw new TicketNotOpenException(ticketId, ticket.Status);
        }

        var now = _clock.UtcNow;
        var quote = _fees.Quote(ticket, now);

        var permitExempt = false;
        if (!quote.IsLost && quote.Amount > 0 && ticket.PermitCode is not null)
        {
            var permit = await _permits.GetByCodeAsync(ticket.PermitCode, ct);
            if (permit is not null && permit.ValidFromUtc <= now && now <= permit.ValidUntilUtc)
            {
                permitExempt = true;
                quote = quote with { Amount = 0.00m, CoveredByPermit = true };
            }
        }

        // EV charging: flat surcharge when explicitly requested on the payment.
        var amount = quote.Amount;
        if (evChargingUsed && ticket.VehicleType == VehicleType.Ev && !quote.IsLost && !permitExempt)
        {
            amount += _feeOptions.EvChargingSurcharge;
        }
        // Rounding policy: to cents, away from zero, final step only.
        amount = Math.Round(amount, 2, MidpointRounding.AwayFromZero);

        var payment = new PaymentRecord(
            Guid.NewGuid(), ticketId, amount, paymentMethod, now, evChargingUsed, RefundedAtUtc: null, permitExempt);
        await _payments.AddAsync(payment, ct);

        var paid = ticket with { Status = TicketStatus.Paid };
        await _tickets.UpdateAsync(paid, ct);
        return payment;
    }

    /// <summary>Refunds a payment (admin only, enforced at the boundary). Allowed only
    /// within 24h of payment and only once.</summary>
    public async Task<PaymentRecord> RefundAsync(Guid paymentId, CancellationToken ct = default)
    {
        var payment = await _payments.GetByIdAsync(paymentId, ct)
            ?? throw new PaymentNotFoundException(paymentId);
        if (payment.RefundedAtUtc is not null)
        {
            throw new AlreadyRefundedException(paymentId);
        }
        if ((_clock.UtcNow - payment.PaidAtUtc).TotalHours > _feeOptions.RefundWindowHours)
        {
            throw new RefundWindowClosedException(paymentId, payment.PaidAtUtc);
        }

        var refunded = payment with { RefundedAtUtc = _clock.UtcNow };
        await _payments.UpdateAsync(refunded, ct);
        return refunded;
    }

    /// <summary>Fetches one payment.</summary>
    public async Task<PaymentRecord> GetAsync(Guid id, CancellationToken ct = default)
        => await _payments.GetByIdAsync(id, ct) ?? throw new PaymentNotFoundException(id);
}
