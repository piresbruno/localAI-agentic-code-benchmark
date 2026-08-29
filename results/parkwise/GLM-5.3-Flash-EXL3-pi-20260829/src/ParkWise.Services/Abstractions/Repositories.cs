namespace ParkWise.Services.Abstractions;
using ParkWise.Contracts;

/// <summary>Repository of physical bays. Storage only; allocation policy lives in services.</summary>
public interface IBayRepository
{
    /// <summary>Ids of free bays for each bay type, keyed by type.</summary>
    Task<Dictionary<BayType, List<Guid>>> GetFreeBayIdsByTypeAsync(CancellationToken ct = default);

    /// <summary>All bays with their current status.</summary>
    Task<IReadOnlyList<BaySnapshot>> GetAllBaysAsync(CancellationToken ct = default);

    /// <summary>Race-safe allocation: occupies the bay only if still free.
    /// Returns false when another concurrent entry won the bay.</summary>
    Task<bool> TryOccupyAsync(Guid bayId, Guid ticketId, CancellationToken ct = default);

    /// <summary>Returns a bay to the free pool after exit.</summary>
    Task FreeAsync(Guid bayId, CancellationToken ct = default);
}

/// <summary>Immutable view of a bay for reporting/allocation decisions.</summary>
public record BaySnapshot(Guid Id, int Level, BayType Type, bool Occupied, Guid? CurrentTicketId);

/// <summary>Ticket persistence.</summary>
public interface ITicketRepository
{
    Task AddAsync(TicketRecord ticket, CancellationToken ct = default);
    Task<TicketRecord?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task UpdateAsync(TicketRecord ticket, CancellationToken ct = default);
}

/// <summary>Payment persistence.</summary>
public interface IPaymentRepository
{
    Task AddAsync(PaymentRecord payment, CancellationToken ct = default);
    Task<PaymentRecord?> GetByIdAsync(Guid id, CancellationToken ct = default);
    Task UpdateAsync(PaymentRecord payment, CancellationToken ct = default);

    /// <summary>Payments whose PaidAt falls within [from, to) (UTC), excluding refunded ones.</summary>
    Task<IReadOnlyList<PaymentRecord>> GetInRangeAsync(DateTime fromUtc, DateTime toUtc, CancellationToken ct = default);
}

/// <summary>Permit persistence.</summary>
public interface IPermitRepository
{
    Task AddAsync(PermitRecord permit, CancellationToken ct = default);
    Task<PermitRecord?> GetByCodeAsync(string code, CancellationToken ct = default);
    Task<PermitRecord?> GetActiveByPlateAsync(string plate, DateTime atUtc, CancellationToken ct = default);
    Task<IReadOnlyList<PermitRecord>> GetAllAsync(CancellationToken ct = default);
    Task<bool> DeleteAsync(string code, CancellationToken ct = default);
}

/// <summary>Operator account persistence.</summary>
public interface IOperatorRepository
{
    Task<OperatorRecord?> GetByUsernameAsync(string username, CancellationToken ct = default);
    Task AddAsync(OperatorRecord user, CancellationToken ct = default);
}
