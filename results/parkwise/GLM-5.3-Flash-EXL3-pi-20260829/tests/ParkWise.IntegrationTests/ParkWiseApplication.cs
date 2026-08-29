using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using ParkWise.Contracts;
using ParkWise.Data;

namespace ParkWise.IntegrationTests;

/// <summary>Application factory for integration tests: real pipeline against a private
/// temp-file SQLite database (concurrency-safe: every request opens its own connection).
/// The environment is set to "Testing" so the app loads appsettings.Testing.json, which
/// shrinks the garage to a small, deterministic bay layout.</summary>
public sealed class ParkWiseApplication : WebApplicationFactory<Program>
{
    private readonly string _databasePath = Path.Combine(Path.GetTempPath(), $"parkwise-test-{Guid.NewGuid():N}.db");

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");
        // Private SQLite file per factory instance. ConfigureServices overrides are
        // buffered by the deferred host and replace the app's own registrations.
        builder.ConfigureServices(services =>
        {
            services.RemoveAll<DbContextOptions<ParkWiseDbContext>>();
            services.RemoveAll<ParkWiseDbContext>();
            services.AddDbContext<ParkWiseDbContext>(options =>
                options.UseSqlite($"Data Source={_databasePath}"));

            // Small deterministic garage (10 standard bays) for predictable capacity tests.
            services.RemoveAll<ParkWise.Services.Options.GarageOptions>();
            services.AddSingleton(new ParkWise.Services.Options.GarageOptions
            {
                Levels = 1,
                Bays =
                [
                    new ParkWise.Services.Options.BaySpec { Level = 1, Type = "standard", Count = 10 },
                    new ParkWise.Services.Options.BaySpec { Level = 1, Type = "compact", Count = 4 },
                    new ParkWise.Services.Options.BaySpec { Level = 1, Type = "motorcycle", Count = 3 },
                    new ParkWise.Services.Options.BaySpec { Level = 1, Type = "ev", Count = 2 },
                ],
            });
        });
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing)
        {
            try
            {
                if (File.Exists(_databasePath))
                {
                    File.Delete(_databasePath);
                }
            }
            catch (IOException)
            {
                // best effort cleanup
            }
        }
        base.Dispose(disposing);
    }
}

/// <summary>Test authentication helpers.</summary>
public static class TestAuth
{
    public static async Task<string> LoginAsync(HttpClient client, string username, string password)
    {
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username, password });
        response.EnsureSuccessStatusCode();
        var body = await response.Content.ReadFromJsonAsync<AuthResponse>();
        return body!.Token;
    }
}
