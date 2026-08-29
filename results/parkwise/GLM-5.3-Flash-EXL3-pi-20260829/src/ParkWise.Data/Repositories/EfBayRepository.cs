using Microsoft.EntityFrameworkCore;
using ParkWise.Contracts;
using ParkWise.Data.Entities;
using ParkWise.Services.Abstractions;

namespace ParkWise.Data.Repositories;

/// <summary>EF Core implementation of bay persistence. Allocation is race-safe:
/// TryOccupyAsync performs a conditional UPDATE (Status: Free→Occupied) and reports
/// whether it won, so concurrent entries can never share a bay.</summary>
public class EfBayRepository : IBayRepository
{
    private readonly ParkWiseDbContext _db;

    public EfBayRepository(ParkWiseDbContext db) => _db = db;

    public async Task<Dictionary<BayType, List<Guid>>> GetFreeBayIdsByTypeAsync(CancellationToken ct = default)
    {
        var free = await _db.Bays
            .AsNoTracking()
            .Where(b => b.Status == BayStatus.Free)
            .Select(b => new { b.Id, b.Type })
            .ToListAsync(ct);
        return free
            .GroupBy(b => b.Type)
            .ToDictionary(g => g.Key, g => g.Select(b => b.Id).ToList());
    }

    public async Task<IReadOnlyList<BaySnapshot>> GetAllBaysAsync(CancellationToken ct = default)
    {
        var bays = await _db.Bays
            .AsNoTracking()
            .OrderBy(b => b.Level).ThenBy(b => b.Type)
            .Select(b => new BaySnapshot(b.Id, b.Level, b.Type, b.Status == BayStatus.Occupied, b.CurrentTicketId))
            .ToListAsync(ct);
        return bays;
    }

    public async Task<bool> TryOccupyAsync(Guid bayId, Guid ticketId, CancellationToken ct = default)
    {
        var updated = await _db.Bays
            .Where(b => b.Id == bayId && b.Status == BayStatus.Free)
            .ExecuteUpdateAsync(
                s => s
                    .SetProperty(b => b.Status, BayStatus.Occupied)
                    .SetProperty(b => b.CurrentTicketId, ticketId),
                ct);
        return updated == 1;
    }

    public async Task FreeAsync(Guid bayId, CancellationToken ct = default)
    {
        await _db.Bays
            .Where(b => b.Id == bayId)
            .ExecuteUpdateAsync(
                s => s
                    .SetProperty(b => b.Status, BayStatus.Free)
                    .SetProperty(b => b.CurrentTicketId, (Guid?)null),
                ct);
    }
}
