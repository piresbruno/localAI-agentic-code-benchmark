using ParkWise.Contracts;

namespace ParkWise.Services;

/// <summary>Base class for domain errors. Message is safe to show to API callers.</summary>
public abstract class DomainException(string code, string message, int statusCode, object? details = null)
    : Exception(message)
{
    public string Code { get; } = code;
    public int StatusCode { get; } = statusCode;
    public object? Details { get; } = details;
}

/// <summary>No compatible bay is free — garage (or vehicle type) full.</summary>
public sealed class GarageFullException(IReadOnlyCollection<BayType> fullTypes)
    : DomainException(ErrorCodes.GarageFull, "No compatible bay is free for this vehicle type.", 409,
        new { full = fullTypes.Select(t => t.ToString()).ToArray() });

/// <summary>The ticket has already exited.</summary>
public sealed class AlreadyExitedException(Guid ticketId)
    : DomainException(ErrorCodes.AlreadyExited, $"Ticket {ticketId} has already exited.", 409);

/// <summary>Exit requires payment first; carries the outstanding quote.</summary>
public sealed class PaymentRequiredException(QuoteResponse quote)
    : DomainException(ErrorCodes.PaymentRequired, "Payment required before exit.", 402, quote);

/// <summary>Ticket id unknown.</summary>
public sealed class TicketNotFoundException(Guid ticketId)
    : DomainException(ErrorCodes.TicketNotFound, $"Ticket {ticketId} not found.", 404);

/// <summary>Plate fails the configured format.</summary>
public sealed class PlateInvalidException(string plate)
    : DomainException(ErrorCodes.PlateInvalid, $"Plate '{plate}' is not valid. Expected format: AA-999-AA.", 422);

/// <summary>Vehicle type string is not recognized.</summary>
public sealed class VehicleTypeInvalidException(string value)
    : DomainException(ErrorCodes.VehicleTypeInvalid, $"Unknown vehicle type '{value}'.", 422);

/// <summary>Payment method string is not recognized.</summary>
public sealed class PaymentMethodInvalidException(string value)
    : DomainException(ErrorCodes.PaymentMethodInvalid, $"Unknown payment method '{value}'.", 422);

/// <summary>Ticket is not in a state that allows this operation.</summary>
public sealed class TicketNotOpenException(Guid ticketId, TicketStatus status)
    : DomainException(ErrorCodes.TicketNotOpen, $"Ticket {ticketId} is {status.ToString().ToLowerInvariant()} and cannot be modified.", 409);

/// <summary>Permit code already exists.</summary>
public sealed class PermitDuplicateException(string code)
    : DomainException(ErrorCodes.PermitDuplicate, $"Permit '{code}' already exists.", 409);

/// <summary>Permit code unknown.</summary>
public sealed class PermitNotFoundException(string code)
    : DomainException(ErrorCodes.PermitNotFound, $"Permit '{code}' not found.", 404);

/// <summary>Payment id unknown.</summary>
public sealed class PaymentNotFoundException(Guid id)
    : DomainException(ErrorCodes.PaymentNotFound, $"Payment {id} not found.", 404);

/// <summary>Refund requested after the 24h window.</summary>
public sealed class RefundWindowClosedException(Guid paymentId, DateTime paidAt)
    : DomainException(ErrorCodes.RefundWindowClosed,
        $"Payment {paymentId} can only be refunded within 24h of payment ({paidAt:O}).", 409);

/// <summary>Payment was already refunded.</summary>
public sealed class AlreadyRefundedException(Guid paymentId)
    : DomainException(ErrorCodes.AlreadyRefunded, $"Payment {paymentId} has already been refunded.", 409);

/// <summary>Generic validation failure.</summary>
public sealed class ValidationException(string message, object? details = null)
    : DomainException(ErrorCodes.ValidationFailed, message, 422, details);

/// <summary>Credentials rejected.</summary>
public sealed class UnauthorizedException(string message = "Invalid credentials.")
    : DomainException(ErrorCodes.Unauthorized, message, 401);
