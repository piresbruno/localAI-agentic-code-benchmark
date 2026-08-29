using Microsoft.EntityFrameworkCore;
using ParkWise.Data.Entities;
using ParkWise.Services.Abstractions;

namespace ParkWise.Data.Repositories;

/// <summary>Mappers between EF entities and service-layer records.</summary>
internal static class Mappers
{
    public static TicketRecord ToRecord(Ticket t) => new(
        t.Id, t.Plate, t.VehicleType, t.BayId, t.Bay?.Type.ToString() ?? string.Empty,
        t.Bay?.Level ?? 0, t.EntryAt, t.ExitAt, t.Status, t.PermitCode, t.ReportedLostAt);

    public static PaymentRecord ToRecord(Payment p) => new(
        p.Id, p.TicketId, p.Amount, p.Method, p.PaidAt, p.EvChargingUsed, p.RefundedAt, p.PermitExempt);

    public static PermitRecord ToRecord(Permit p) => new(p.Code, p.Plate, p.ValidFrom, p.ValidUntil);

    public static OperatorRecord ToRecord(OperatorUser u) => new(u.Id, u.Username, u.Role, u.PasswordHash);
}

/// <summary>EF Core ticket persistence.</summary>
public class EfTicketRepository : ITicketRepository
{
    private readonly ParkWiseDbContext _db;

    public EfTicketRepository(ParkWiseDbContext db) => _db = db;

    public async Task AddAsync(TicketRecord record, CancellationToken ct = default)
    {
        _db.Tickets.Add(FromRecord(record));
        await _db.SaveChangesAsync(ct);
    }

    public async Task<TicketRecord?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var ticket = await _db.Tickets.AsNoTracking().Include(t => t.Bay).FirstOrDefaultAsync(t => t.Id == id, ct);
        return ticket is null ? null : Mappers.ToRecord(ticket);
    }

    public async Task UpdateAsync(TicketRecord record, CancellationToken ct = default)
    {
        var ticket = await _db.Tickets.FirstOrDefaultAsync(t => t.Id == record.Id, ct)
            ?? throw new InvalidOperationException($"Ticket {record.Id} vanished during update.");
        ticket.Plate = record.Plate;
        ticket.VehicleType = record.VehicleType;
        ticket.BayId = record.BayId;
        ticket.EntryAt = record.EntryAtUtc;
        ticket.ExitAt = record.ExitAtUtc;
        ticket.Status = record.Status;
        ticket.PermitCode = record.PermitCode;
        ticket.ReportedLostAt = record.ReportedLostAtUtc;
        await _db.SaveChangesAsync(ct);
    }

    private static Ticket FromRecord(TicketRecord r) => new()
    {
        Id = r.Id, Plate = r.Plate, VehicleType = r.VehicleType, BayId = r.BayId,
        EntryAt = r.EntryAtUtc, ExitAt = r.ExitAtUtc, Status = r.Status,
        PermitCode = r.PermitCode, ReportedLostAt = r.ReportedLostAtUtc,
    };
}

/// <summary>EF Core payment persistence.</summary>
public class EfPaymentRepository : IPaymentRepository
{
    private readonly ParkWiseDbContext _db;

    public EfPaymentRepository(ParkWiseDbContext db) => _db = db;

    public async Task AddAsync(PaymentRecord record, CancellationToken ct = default)
    {
        _db.Payments.Add(FromRecord(record));
        await _db.SaveChangesAsync(ct);
    }

    public async Task<PaymentRecord?> GetByIdAsync(Guid id, CancellationToken ct = default)
    {
        var payment = await _db.Payments.AsNoTracking().FirstOrDefaultAsync(p => p.Id == id, ct);
        return payment is null ? null : Mappers.ToRecord(payment);
    }

    public async Task UpdateAsync(PaymentRecord record, CancellationToken ct = default)
    {
        var payment = await _db.Payments.FirstOrDefaultAsync(p => p.Id == record.Id, ct)
            ?? throw new InvalidOperationException($"Payment {record.Id} vanished during update.");
        payment.Amount = record.Amount;
        payment.Method = record.Method;
        payment.PaidAt = record.PaidAtUtc;
        payment.EvChargingUsed = record.EvChargingUsed;
        payment.RefundedAt = record.RefundedAtUtc;
        payment.PermitExempt = record.PermitExempt;
        await _db.SaveChangesAsync(ct);
    }

    public async Task<IReadOnlyList<PaymentRecord>> GetInRangeAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default)
    {
        var payments = await _db.Payments
            .AsNoTracking()
            .Where(p => p.PaidAt >= fromUtc && p.PaidAt < toUtc)
            .OrderBy(p => p.PaidAt)
            .ToListAsync(ct);
        return payments.Select(Mappers.ToRecord).ToList();
    }

    private static Payment FromRecord(PaymentRecord r) => new()
    {
        Id = r.Id, TicketId = r.TicketId, Amount = r.Amount, Method = r.Method,
        PaidAt = r.PaidAtUtc, EvChargingUsed = r.EvChargingUsed, RefundedAt = r.RefundedAtUtc,
        PermitExempt = r.PermitExempt,
    };
}

/// <summary>EF Core permit persistence.</summary>
public class EfPermitRepository : IPermitRepository
{
    private readonly ParkWiseDbContext _db;

    public EfPermitRepository(ParkWiseDbContext db) => _db = db;

    public async Task AddAsync(PermitRecord record, CancellationToken ct = default)
    {
        _db.Permits.Add(new Permit
        {
            Code = record.Code, Plate = record.Plate, ValidFrom = record.ValidFromUtc, ValidUntil = record.ValidUntilUtc,
        });
        await _db.SaveChangesAsync(ct);
    }

    public async Task<PermitRecord?> GetByCodeAsync(string code, CancellationToken ct = default)
    {
        var permit = await _db.Permits.AsNoTracking().FirstOrDefaultAsync(p => p.Code == code.ToUpperInvariant(), ct);
        return permit is null ? null : Mappers.ToRecord(permit);
    }

    public async Task<PermitRecord?> GetActiveByPlateAsync(string plate, DateTime atUtc, CancellationToken ct = default)
    {
        var permit = await _db.Permits
            .AsNoTracking()
            .Where(p => p.Plate == plate && p.ValidFrom <= atUtc && atUtc <= p.ValidUntil)
            .OrderByDescending(p => p.ValidUntil)
            .FirstOrDefaultAsync(ct);
        return permit is null ? null : Mappers.ToRecord(permit);
    }

    public async Task<IReadOnlyList<PermitRecord>> GetAllAsync(CancellationToken ct = default)
    {
        var permits = await _db.Permits.AsNoTracking().OrderBy(p => p.Code).ToListAsync(ct);
        return permits.Select(Mappers.ToRecord).ToList();
    }

    public async Task<bool> DeleteAsync(string code, CancellationToken ct = default)
    {
        var deleted = await _db.Permits.Where(p => p.Code == code.ToUpperInvariant()).ExecuteDeleteAsync(ct);
        return deleted == 1;
    }
}

/// <summary>EF Core operator persistence.</summary>
public class EfOperatorRepository : IOperatorRepository
{
    private readonly ParkWiseDbContext _db;

    public EfOperatorRepository(ParkWiseDbContext db) => _db = db;

    public async Task<OperatorRecord?> GetByUsernameAsync(string username, CancellationToken ct = default)
    {
        var user = await _db.Operators.AsNoTracking().FirstOrDefaultAsync(u => u.Username == username, ct);
        return user is null ? null : Mappers.ToRecord(user);
    }

    public async Task AddAsync(OperatorRecord record, CancellationToken ct = default)
    {
        _db.Operators.Add(new OperatorUser
        {
            Id = record.Id, Username = record.Username, Role = record.Role, PasswordHash = record.PasswordHash,
        });
        await _db.SaveChangesAsync(ct);
    }
}
