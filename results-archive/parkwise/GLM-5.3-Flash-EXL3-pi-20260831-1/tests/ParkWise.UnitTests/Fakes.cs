using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Services.Domain;

namespace ParkWise.UnitTests;

/// <summary>In-memory ticket repository fake — no EF in unit tests (spec §8).</summary>
public sealed class FakeTicketRepository : ITicketRepository
{
    public Dictionary<Guid, Ticket> Store { get; } = [];
    public int NextId;

    public Task<Ticket?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(Store.GetValueOrDefault(id));

    public Task<IReadOnlyList<Ticket>> ListByStatusAsync(TicketStatus? status, CancellationToken ct = default) =>
        Task.FromResult((IReadOnlyList<Ticket>)Store.Values.Where(t => status is null || t.Status == status).OrderBy(t => t.EntryAtUtc).ToList());

    public Task<IReadOnlyList<Ticket>> ListActiveAsync(CancellationToken ct = default) =>
        Task.FromResult((IReadOnlyList<Ticket>)Store.Values.Where(t => t.Status.OccupiesBay()).OrderBy(t => t.EntryAtUtc).ToList());

    public Task AddAsync(Ticket ticket, CancellationToken ct = default)
    {
        Store[ticket.Id] = ticket;
        return Task.CompletedTask;
    }

    public Task UpdateAsync(Ticket ticket, CancellationToken ct = default)
    {
        Store[ticket.Id] = ticket;
        return Task.CompletedTask;
    }
}

public sealed class FakePaymentRepository : IPaymentRepository
{
    public Dictionary<Guid, PaymentReceipt> Store { get; } = [];

    public Task<PaymentReceipt?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        Task.FromResult(Store.GetValueOrDefault(id));

    public Task<PaymentReceipt?> FindByTicketIdAsync(Guid ticketId, CancellationToken ct = default) =>
        Task.FromResult(Store.Values.FirstOrDefault(p => p.TicketId == ticketId));

    public Task AddAsync(PaymentReceipt receipt, CancellationToken ct = default)
    {
        Store[receipt.Id] = receipt;
        return Task.CompletedTask;
    }
}
