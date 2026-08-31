using ParkWise.Contracts;

namespace ParkWise.Services.Domain;

/// <summary>A settled payment for a ticket (receipt). Amount is EUR, rounded to cents away from zero.</summary>
public sealed class PaymentReceipt
{
    public Guid Id { get; private set; }
    public Guid TicketId { get; private set; }
    public decimal Amount { get; private set; }
    public PaymentMethod Method { get; private set; }
    public DateTime PaidAtUtc { get; private set; }

    private PaymentReceipt() { } // EF

    public PaymentReceipt(Guid ticketId, decimal amount, PaymentMethod method, DateTime paidAtUtc)
    {
        if (amount < 0) throw new AppException(ErrorCodes.ValidationError, 400, "Payment amount cannot be negative.");
        Id = Guid.NewGuid();
        TicketId = ticketId;
        Amount = amount;
        Method = method;
        PaidAtUtc = paidAtUtc;
    }
}
