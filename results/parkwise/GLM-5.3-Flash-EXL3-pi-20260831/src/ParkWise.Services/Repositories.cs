using ParkWise.Services.Domain;
using ParkWise.Contracts;

namespace ParkWise.Services;

/// <summary>Ticket persistence — implemented by ParkWise.Data (EF Core); faked in unit tests.</summary>
public interface ITicketRepository
{
    Task<Ticket?> FindByIdAsync(Guid id, CancellationToken ct = default);
    Task<IReadOnlyList<Ticket>> ListByStatusAsync(TicketStatus? status, CancellationToken ct = default);
    Task<IReadOnlyList<Ticket>> ListActiveAsync(CancellationToken ct = default);
    Task AddAsync(Ticket ticket, CancellationToken ct = default);
    Task UpdateAsync(Ticket ticket, CancellationToken ct = default);
}

/// <summary>Payment receipt persistence.</summary>
public interface IPaymentRepository
{
    Task<PaymentReceipt?> FindByIdAsync(Guid id, CancellationToken ct = default);
    Task<PaymentReceipt?> FindByTicketIdAsync(Guid ticketId, CancellationToken ct = default);
    Task AddAsync(PaymentReceipt receipt, CancellationToken ct = default);
}

/// <summary>Tickets that still occupy a bay (open, paid or lost).</summary>
public static class TicketStatusExtensions
{
    public static bool OccupiesBay(this TicketStatus status) =>
        status is TicketStatus.Open or TicketStatus.Paid or TicketStatus.Lost;
}
