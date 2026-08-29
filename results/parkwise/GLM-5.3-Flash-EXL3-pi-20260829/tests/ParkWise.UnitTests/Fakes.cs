using ParkWise.Contracts;
using ParkWise.Services.Abstractions;

namespace ParkWise.UnitTests;

/// <summary>In-memory fakes for repositories — services are tested without EF (spec §7).</summary>
public sealed class FakeBayRepository : IBayRepository
{
    private readonly Dictionary<Guid, BaySnapshot> _bays = new();
    private readonly object _lock = new();

    public FakeBayRepository(params (int level, BayType type, int count)[] specs)
    {
        foreach (var (level, type, count) in specs)
        {
            for (var i = 0; i < count; i++)
            {
                var id = Guid.NewGuid();
                _bays[id] = new BaySnapshot(id, level, type, false, null);
            }
        }
    }

    public int OccupiedCount => _bays.Values.Count(b => b.Occupied);

    public Task<Dictionary<BayType, List<Guid>>> GetFreeBayIdsByTypeAsync(CancellationToken ct = default)
    {
        lock (_lock)
        {
            return Task.FromResult(_bays.Values
                .Where(b => !b.Occupied)
                .GroupBy(b => b.Type)
                .ToDictionary(g => g.Key, g => g.Select(b => b.Id).ToList()));
        }
    }

    public Task<IReadOnlyList<BaySnapshot>> GetAllBaysAsync(CancellationToken ct = default)
    {
        lock (_lock)
        {
            return Task.FromResult<IReadOnlyList<BaySnapshot>>(_bays.Values.ToList());
        }
    }

    public Task<BaySnapshot?> GetBayByIdAsync(Guid bayId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            _bays.TryGetValue(bayId, out var bay);
            return Task.FromResult(bay);
        }
    }

    /// <summary>Simulates the conditional DB update atomically.</summary>
    public Task<bool> TryOccupyAsync(Guid bayId, Guid ticketId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            if (_bays.TryGetValue(bayId, out var bay) && !bay.Occupied)
            {
                _bays[bayId] = bay with { Occupied = true, CurrentTicketId = ticketId };
                return Task.FromResult(true);
            }
            return Task.FromResult(false);
        }
    }

    public Task FreeAsync(Guid bayId, CancellationToken ct = default)
    {
        lock (_lock)
        {
            if (_bays.TryGetValue(bayId, out var bay))
            {
                _bays[bayId] = bay with { Occupied = false, CurrentTicketId = null };
            }
            return Task.CompletedTask;
        }
    }
}

public sealed class FakeTicketRepository : ITicketRepository
{
    private readonly Dictionary<Guid, TicketRecord> _tickets = new();

    public Task AddAsync(TicketRecord ticket, CancellationToken ct = default)
    {
        _tickets[ticket.Id] = ticket;
        return Task.CompletedTask;
    }

    public Task<TicketRecord?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => Task.FromResult(_tickets.GetValueOrDefault(id));

    public Task UpdateAsync(TicketRecord ticket, CancellationToken ct = default)
    {
        _tickets[ticket.Id] = ticket;
        return Task.CompletedTask;
    }

    public int CountByStatus(TicketStatus status) => _tickets.Values.Count(t => t.Status == status);
}

public sealed class FakePaymentRepository : IPaymentRepository
{
    private readonly Dictionary<Guid, PaymentRecord> _payments = new();

    public Task AddAsync(PaymentRecord payment, CancellationToken ct = default)
    {
        _payments[payment.Id] = payment;
        return Task.CompletedTask;
    }

    public Task<PaymentRecord?> GetByIdAsync(Guid id, CancellationToken ct = default)
        => Task.FromResult(_payments.GetValueOrDefault(id));

    public Task UpdateAsync(PaymentRecord payment, CancellationToken ct = default)
    {
        _payments[payment.Id] = payment;
        return Task.CompletedTask;
    }

    public Task<IReadOnlyList<PaymentRecord>> GetInRangeAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<PaymentRecord>>(
            _payments.Values.Where(p => p.PaidAtUtc >= fromUtc && p.PaidAtUtc < toUtc).ToList());
}

public sealed class FakePermitRepository : IPermitRepository
{
    private readonly Dictionary<string, PermitRecord> _permits = new(StringComparer.OrdinalIgnoreCase);

    public Task AddAsync(PermitRecord permit, CancellationToken ct = default)
    {
        _permits[permit.Code] = permit;
        return Task.CompletedTask;
    }

    public Task<PermitRecord?> GetByCodeAsync(string code, CancellationToken ct = default)
        => Task.FromResult(_permits.GetValueOrDefault(code));

    public Task<PermitRecord?> GetActiveByPlateAsync(string plate, DateTime atUtc, CancellationToken ct = default)
        => Task.FromResult(_permits.Values.FirstOrDefault(
            p => p.Plate.Equals(plate, StringComparison.OrdinalIgnoreCase)
                 && p.ValidFromUtc <= atUtc && atUtc <= p.ValidUntilUtc));

    public Task<PermitRecord?> GetLatestByPlateAsync(string plate, CancellationToken ct = default)
        => Task.FromResult(_permits.Values
            .Where(p => p.Plate.Equals(plate, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(p => p.ValidUntilUtc)
            .FirstOrDefault());

    public Task<IReadOnlyList<PermitRecord>> GetAllAsync(CancellationToken ct = default)
        => Task.FromResult<IReadOnlyList<PermitRecord>>(_permits.Values.ToList());

    public Task<bool> DeleteAsync(string code, CancellationToken ct = default)
        => Task.FromResult(_permits.Remove(code));
}

public sealed class FakeOperatorRepository : IOperatorRepository
{
    private readonly Dictionary<string, OperatorRecord> _users = new(StringComparer.OrdinalIgnoreCase);

    public Task<OperatorRecord?> GetByUsernameAsync(string username, CancellationToken ct = default)
        => Task.FromResult(_users.GetValueOrDefault(username));

    public Task AddAsync(OperatorRecord user, CancellationToken ct = default)
    {
        _users[user.Username] = user;
        return Task.CompletedTask;
    }

    public void Seed(OperatorRecord user) => _users[user.Username] = user;
}
