using ParkWise.Contracts;

namespace ParkWise.Services;

/// <summary>
/// Domain error carrying an API error code, HTTP status and a safe message; the API's single
/// exception middleware maps it to `{ error: { code, message, details? } }`.
/// </summary>
public class AppException : Exception
{
    public string Code { get; }
    public int StatusCode { get; }
    public IReadOnlyDictionary<string, object?>? Details { get; }

    public AppException(string code, int statusCode, string message, IReadOnlyDictionary<string, object?>? details = null)
        : base(message)
    {
        Code = code;
        StatusCode = statusCode;
        Details = details;
    }

    public static AppException NotFound(string what) =>
        new(ErrorCodes.NotFound, 404, $"{what} not found.");

    public static AppException Validation(string message, string field) =>
        new(ErrorCodes.ValidationError, 400, message, new Dictionary<string, object?> { ["details"] = new[] { new { field, message } } });
}
