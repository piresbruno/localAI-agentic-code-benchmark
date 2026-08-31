using System.Text.Json;
using ParkWise.Contracts;

namespace ParkWise.Api.Middleware;

/// <summary>
/// The one shared exception handler (spec §5): AppException → its status and the
/// `{ error: { code, message, details? } }` contract; anything else → generic 500.
/// </summary>
public sealed class ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (Services.AppException ex)
        {
            var error = ex.Details is null
                ? new ErrorBody(ex.Code, ex.Message)
                : new ErrorBody(ex.Code, ex.Message, ex.Details);
            context.Response.StatusCode = ex.StatusCode;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(JsonSerializer.Serialize(new { error }, JsonOpts));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception on {Path}", context.Request.Path);
            context.Response.StatusCode = 500;
            context.Response.ContentType = "application/json";
            await context.Response.WriteAsync(
                JsonSerializer.Serialize(new ErrorBody(ErrorCodes.Internal, "Something went wrong on our side."), JsonOpts));
        }
    }

    private static readonly JsonSerializerOptions JsonOpts = new(JsonSerializerDefaults.Web);

    private sealed record ErrorBody(string Code, string Message, object? Details = null);
}
