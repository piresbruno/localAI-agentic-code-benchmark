using System.ComponentModel.DataAnnotations;

namespace ParkWise.Contracts;

/// <summary>Request body for vehicle entry.</summary>
public record EntryRequest(
    [property: Required] string Plate,
    [property: Required] string VehicleType,
    string? PermitCode = null);

/// <summary>Request body for a payment.</summary>
public record PaymentRequest(
    [property: Required] Guid TicketId,
    [property: Required] string Method,
    bool EvChargingUsed = false);

/// <summary>Request body for creating a permit.</summary>
public record PermitRequest(
    [property: Required] string Code,
    [property: Required] string Plate,
    [property: Required] DateTime ValidFrom,
    [property: Required] DateTime ValidUntil);

/// <summary>Request body for login.</summary>
public record LoginRequest(
    [property: Required] string Username,
    [property: Required] string Password);

/// <summary>Request body for reporting a lost ticket.</summary>
public record LostTicketRequest(
    [property: Required] string Plate);
