namespace ParkWise.Contracts;

/// <summary>Stable error codes surfaced in the <c>error.code</c> field of every failure response.</summary>
public static class ErrorCodes
{
    public const string GarageFull = "GARAGE_FULL";
    public const string AlreadyExited = "ALREADY_EXITED";
    public const string PaymentRequired = "PAYMENT_REQUIRED";
    public const string TicketNotFound = "TICKET_NOT_FOUND";
    public const string PlateInvalid = "PLATE_INVALID";
    public const string PermitExpired = "PERMIT_EXPIRED";
    public const string PermitNotFound = "PERMIT_NOT_FOUND";
    public const string PaymentNotFound = "PAYMENT_NOT_FOUND";
    public const string AlreadyPaid = "ALREADY_PAID";
    public const string RefundWindowExpired = "REFUND_WINDOW_EXPIRED";
    public const string ValidationError = "VALIDATION_ERROR";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
}
