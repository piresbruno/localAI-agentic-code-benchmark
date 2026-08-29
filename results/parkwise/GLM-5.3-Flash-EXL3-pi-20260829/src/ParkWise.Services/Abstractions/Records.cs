namespace ParkWise.Services.Abstractions;
using ParkWise.Contracts;

/// <summary>Persisted ticket state, decoupled from EF entities.</summary>
public record TicketRecord(
    Guid Id,
    string Plate,
    VehicleType VehicleType,
    Guid BayId,
    string BayType,
    int Level,
    DateTime EntryAtUtc,
    DateTime? ExitAtUtc,
    TicketStatus Status,
    string? PermitCode,
    DateTime? ReportedLostAtUtc);

/// <summary>Persisted payment state.</summary>
public record PaymentRecord(
    Guid Id,
    Guid TicketId,
    decimal Amount,
    PaymentMethod Method,
    DateTime PaidAtUtc,
    bool EvChargingUsed,
    DateTime? RefundedAtUtc,
    bool PermitExempt);

/// <summary>Persisted permit state.</summary>
public record PermitRecord(string Code, string Plate, DateTime ValidFromUtc, DateTime ValidUntilUtc);

/// <summary>Persisted operator account.</summary>
public record OperatorRecord(Guid Id, string Username, string Role, string PasswordHash);
