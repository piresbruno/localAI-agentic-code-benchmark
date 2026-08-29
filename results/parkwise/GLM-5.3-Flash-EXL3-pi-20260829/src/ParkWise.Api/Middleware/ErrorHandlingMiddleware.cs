using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;

namespace ParkWise.Api.Middleware;

/// <summary>One shared exception-handling middleware: maps DomainException → the canonical
/// error envelope. Unexpected exceptions become 500 INTERNAL without internals leaked
/// (details are logged server-side).</summary>
public sealed class ErrorHandlingMiddleware
{
    private readonly RequestDelegate _next;
    private readonly ILogger<ErrorHandlingMiddleware> _logger;

    public ErrorHandlingMiddleware(RequestDelegate next, ILogger<ErrorHandlingMiddleware> logger)
    {
        _next = next;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (DomainException domain)
        {
            _logger.LogWarning("Domain error {Code}: {Message}", domain.Code, domain.Message);
            await WriteErrorAsync(context, domain.StatusCode, domain.Code, domain.Message, domain.Details);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception processing {Method} {Path}", context.Request.Method, context.Request.Path);
            await WriteErrorAsync(context, StatusCodes.Status500InternalServerError, ErrorCodes.Internal,
                "Something went wrong. Please try again.");
        }
    }

    private static async Task WriteErrorAsync(HttpContext context, int statusCode, string code, string message, object? details = null)
    {
        if (context.Response.HasStarted)
        {
            return;
        }
        context.Response.Clear();
        context.Response.StatusCode = statusCode;
        context.Response.ContentType = "application/json";
        await context.Response.WriteAsJsonAsync(new ErrorBody(code, message, details));
    }
}

/// <summary>Extension to register the middleware.</summary>
public static class ErrorHandlingExtensions
{
    public static IApplicationBuilder UseErrorHandling(this IApplicationBuilder app)
        => app.UseMiddleware<ErrorHandlingMiddleware>();
}

/// <summary>Maps MVC model-binding validation failures onto the shared envelope.</summary>
public static class ValidationProblemExtensions
{
    public static IActionResult ToErrorBody(this ActionContext context)
    {
        var details = context.ModelState
            .Where(kvp => kvp.Value?.Errors.Count > 0)
            .SelectMany(kvp => kvp.Value!.Errors.Select(e => new { field = kvp.Key, message = e.ErrorMessage }))
            .ToList();
        var first = details.FirstOrDefault()?.message ?? "Invalid request.";
        return new BadRequestObjectResult(new ErrorBody(ErrorCodes.ValidationFailed, first, details));
    }
}
