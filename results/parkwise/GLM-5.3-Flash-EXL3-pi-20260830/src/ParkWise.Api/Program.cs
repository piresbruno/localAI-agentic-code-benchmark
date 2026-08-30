using ParkWise.Services;

var builder = WebApplication.CreateBuilder(args);
builder.Services.AddSingleton<IClock, SystemClock>();
var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

/// <summary>System clock implementation; the only place DateTime.UtcNow is called.</summary>
internal class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
