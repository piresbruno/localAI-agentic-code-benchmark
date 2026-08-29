namespace ParkWise.Contracts;

/// <summary>Canonical error envelope returned by every failure path.</summary>
public record ErrorBody(string Code, string Message, object? Details = null);

/// <summary>Well-known error codes surfaced by the API.</summary>
public static class ErrorCodes
{
    public const string GarageFull = "GARAGE_FULL";
    public const string AlreadyExited = "ALREADY_EXITED";
    public const string PaymentRequired = "PAYMENT_REQUIRED";
    public const string TicketNotFound = "TICKET_NOT_FOUND";
    public const string PlateInvalid = "PLATE_INVALID";
    public const string PermitExpired = "PERMIT_EXPIRED";
    public const string PermitNotFound = "PERMIT_NOT_FOUND";
    public const string PermitDuplicate = "PERMIT_DUPLICATE";
    public const string PaymentNotFound = "PAYMENT_NOT_FOUND";
    public const string RefundWindowClosed = "REFUND_WINDOW_CLOSED";
    public const string AlreadyRefunded = "ALREADY_REFUNDED";
    public const string TicketNotOpen = "TICKET_NOT_OPEN";
    public const string PaymentMethodInvalid = "PAYMENT_METHOD_INVALID";
    public const string VehicleTypeInvalid = "VEHICLE_TYPE_INVALID";
    public const string Unauthorized = "UNAUTHORIZED";
    public const string Forbidden = "FORBIDDEN";
    public const string ValidationFailed = "VALIDATION_FAILED";
    public const string Internal = "INTERNAL";
}
