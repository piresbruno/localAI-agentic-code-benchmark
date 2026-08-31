namespace ParkWise.Contracts;

/// <summary>Stable API error codes surfaced in the `{ error: { code, message, details? } }` contract.</summary>
public static class ErrorCodes
{
    public const string GarageFull = "GARAGE_FULL";
    public const string AlreadyExited = "ALREADY_EXITED";
    public const string PaymentRequired = "PAYMENT_REQUIRED";
    public const string TicketNotFound = "TICKET_NOT_FOUND";
    public const string PlateInvalid = "PLATE_INVALID";
    public const string TicketAlreadyPaid = "TICKET_ALREADY_PAID";
    public const string InvalidCredentials = "INVALID_CREDENTIALS";
    public const string ValidationError = "VALIDATION_ERROR";
    public const string NotFound = "NOT_FOUND";
    public const string Internal = "INTERNAL";
}
