namespace ParkWise.Contracts;

// Request/response DTOs shared by Api, Services and the UI (single source of truth).
// Enums serialize as strings (JsonStringEnumConverter is configured globally in Program.cs).

public record LoginRequest(string Username, string Password);

public record LoginResponse(string Token, string Username, string Role);

public record EntryRequest(string Plate, VehicleType VehicleType);

public record PaymentRequest(string TicketId, PaymentMethod Method);

/// <summary>A ticket as seen by clients; `CurrentFee` is the live quote at read time.</summary>
public record TicketDto(
    string Id,
    string Plate,
    VehicleType VehicleType,
    string BayId,
    DateTime EntryAt,
    TicketStatus Status,
    decimal CurrentFee,
    string Currency);

/// <summary>Result of an exit request: the completed ticket plus what was collected.</summary>
public record ExitResult(TicketDto Ticket, decimal FeeCollected, string? ReceiptId);

public record PaymentDto(string Id, string TicketId, decimal Amount, PaymentMethod Method, DateTime PaidAt);

public record OccupancyItem(VehicleType Type, int Used, int Total);
