using Microsoft.EntityFrameworkCore;
using ParkWise.Services;
using ParkWise.Contracts;
using ParkWise.Services.Domain;

namespace ParkWise.Data.Repositories;

/// <summary>EF Core implementation of the ticket repository; reads are AsNoTracking (spec §3).</summary>
public sealed class EfTicketRepository(AppDbContext db) : ITicketRepository
{
    public Task<Ticket?> FindByIdAsync(Guid id, CancellationToken ct = default) =>
        db.Tickets.AsNoTracking().FirstOrDefaultAsync(t => t.Id == id, ct);

    public async Task<IReadOnlyList<Ticket>> ListByStatusAsync(TicketStatus? status, CancellationToken ct = default)
    {
        var query = db.Tickets.AsNoTracking().AsQueryable();
        if (status is not null) query = query.Where(t => t.Status == status);
        return await query.OrderBy(t => t.EntryAtUtc).ToListAsync(ct);
    }

    /// <summary>Tickets still occupying a bay: open, paid or lost (only exited frees the bay).</summary>
    public async Task<IReadOnlyList<Ticket>> ListActiveAsync(CancellationToken ct = default)
    {
        var list = await db.Tickets.AsNoTracking()
            .Where(t => t.Status != TicketStatus.Exited)
            .OrderBy(t => t.EntryAtUtc)
            .ToListAsync(ct);
        return list;
    }

    public async Task AddAsync(Ticket ticket, CancellationToken ct = default)
    {
        db.Tickets.Add(ticket);
        await db.SaveChangesAsync(ct);
    }

    public async Task UpdateAsync(Ticket ticket, CancellationToken ct = default)
    {
        var tracked = await db.Tickets.FirstAsync(t => t.Id == ticket.Id, ct);
        db.Entry(tracked).CurrentValues.SetValues(ticket);
        await db.SaveChangesAsync(ct);
    }
}
