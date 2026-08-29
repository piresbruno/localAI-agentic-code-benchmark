using System.ComponentModel.DataAnnotations;

namespace ParkWise.Contracts;

/// <summary>Request body for vehicle entry.</summary>
public record EntryRequest(
    [Required] string Plate,
    [Required] string VehicleType,
    string? PermitCode = null);

/// <summary>Request body for a payment.</summary>
public record PaymentRequest(
    [Required] Guid TicketId,
    [Required] string Method,
    bool EvChargingUsed = false);

/// <summary>Request body for creating a permit.</summary>
public record PermitRequest(
    [Required] string Code,
    [Required] string Plate,
    [Required] DateTime ValidFrom,
    [Required] DateTime ValidUntil);

/// <summary>Request body for login.</summary>
public record LoginRequest(
    [Required] string Username,
    [Required] string Password);

/// <summary>Request body for reporting a lost ticket.</summary>
public record LostTicketRequest(
    [Required] string Plate);
