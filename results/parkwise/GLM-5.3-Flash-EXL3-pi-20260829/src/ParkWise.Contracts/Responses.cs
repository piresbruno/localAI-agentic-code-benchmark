namespace ParkWise.Contracts;

/// <summary>Ticket as returned by the API.</summary>
public record TicketResponse(
    Guid Id,
    string Plate,
    string VehicleType,
    Guid BayId,
    string BayType,
    int Level,
    DateTime EntryAt,
    string Status,
    string? PermitCode);

/// <summary>Fee preview for a ticket (no side effects).</summary>
public record QuoteResponse(
    Guid TicketId,
    string Plate,
    string VehicleType,
    DateTime EntryAt,
    DateTime QuotedAt,
    decimal Amount,
    bool IsGrace,
    bool CoveredByPermit,
    bool IsLost,
    int StartedHours,
    decimal RatePerHour,
    string Currency);

/// <summary>Receipt after a successful payment.</summary>
public record PaymentResponse(
    Guid Id,
    Guid TicketId,
    decimal Amount,
    string Method,
    string Currency,
    DateTime PaidAt,
    bool EvChargingUsed,
    DateTime? RefundedAt,
    string TicketStatus);

/// <summary>A permit as returned by the API.</summary>
public record PermitResponse(
    string Code,
    string Plate,
    DateTime ValidFrom,
    DateTime ValidUntil,
    bool Active);

/// <summary>Result of a permit validation lookup for attendants.</summary>
public record PermitValidationResponse(
    string Plate,
    bool Active,
    string? PermitCode,
    DateTime? ValidUntil,
    string? Reason);

/// <summary>Current occupancy of one bay type.</summary>
public record OccupancyEntry(
    string BayType,
    int Total,
    int Occupied,
    int Free);

/// <summary>One day of the revenue report.</summary>
public record RevenueDay(
    DateTime Date,
    decimal Gross,
    decimal Card,
    decimal Cash,
    decimal App,
    decimal LostTicketFees,
    int PermitExemptStays,
    decimal Refunds);

/// <summary>Per-type usage of the garage right now.</summary>
public record OccupancyResponse(
    IReadOnlyList<OccupancyEntry> Types,
    int TotalFree,
    int TotalOccupied);

/// <summary>Revenue report for a date range.</summary>
public record RevenueReportResponse(
    DateTime From,
    DateTime To,
    IReadOnlyList<RevenueDay> Days);

/// <summary>Successful login result.</summary>
public record AuthResponse(string Token, string Username, string Role);
