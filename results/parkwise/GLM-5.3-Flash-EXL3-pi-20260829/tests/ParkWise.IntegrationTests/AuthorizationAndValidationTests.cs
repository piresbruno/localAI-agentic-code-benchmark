using System.Net;
using System.Net.Http.Json;
using ParkWise.Contracts;

namespace ParkWise.IntegrationTests;

/// <summary>AuthZ, validation, concurrency, and error-contract tests (spec §4/§7).</summary>
public class AuthorizationAndValidationTests : IClassFixture<ParkWiseApplication>
{
    private readonly ParkWiseApplication _factory;

    public AuthorizationAndValidationTests(ParkWiseApplication factory) => _factory = factory;

    [Fact]
    public async Task login_with_bad_credentials_is_401()
    {
        var client = _factory.CreateClient();
        var response = await client.PostAsJsonAsync("/api/auth/login", new { username = "admin", password = "wrong" });
        Assert.Equal(HttpStatusCode.Unauthorized, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<ErrorBody>();
        Assert.Equal(ErrorCodes.Unauthorized, error!.Code);
    }

    [Fact]
    public async Task protected_endpoints_require_auth()
    {
        var client = _factory.CreateClient();
        var entry = await client.PostAsJsonAsync("/api/entries", new { plate = "AB-123-CD", vehicleType = "standard" });
        Assert.Equal(HttpStatusCode.Unauthorized, entry.StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/admin/occupancy")).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await client.GetAsync("/api/permits/validate?plate=AB-123-CD")).StatusCode);
    }

    [Fact]
    public async Task attendant_cannot_access_admin_endpoints()
    {
        var client = _factory.CreateClient();
        client.WithAdminToken(await TestAuth.LoginAsync(client, "attendant", "attendant123"));
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/admin/occupancy")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/admin/revenue/daily?from=2026-01-01&to=2026-01-02")).StatusCode);
        Assert.Equal(HttpStatusCode.Forbidden,
            (await client.GetAsync("/api/permits")).StatusCode);
    }

    [Fact]
    public async Task attendant_can_do_entries_and_validations()
    {
        var client = _factory.CreateClient();
        client.WithAdminToken(await TestAuth.LoginAsync(client, "attendant", "attendant123"));
        var entry = await client.PostAsJsonAsync("/api/entries", new { plate = "AA-111-BB", vehicleType = "compact" });
        Assert.Equal(HttpStatusCode.Created, entry.StatusCode);
        Assert.Equal(HttpStatusCode.OK,
            (await client.GetAsync("/api/permits/validate?plate=AA-111-BB")).StatusCode);
    }

    [Fact]
    public async Task rejects_malformed_plate_with_422()
    {
        var client = _factory.CreateClient();
        client.WithAdminToken(await TestAuth.LoginAsync(client, "admin", "admin123"));
        var response = await client.PostAsJsonAsync("/api/entries", new { plate = "BAD-PLATE", vehicleType = "standard" });
        Assert.Equal((HttpStatusCode)422, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<ErrorBody>();
        Assert.Equal(ErrorCodes.PlateInvalid, error!.Code);
    }

    [Fact]
    public async Task rejects_unknown_vehicle_type_with_422()
    {
        var client = _factory.CreateClient();
        client.WithAdminToken(await TestAuth.LoginAsync(client, "admin", "admin123"));
        var response = await client.PostAsJsonAsync("/api/entries", new { plate = "AA-123-BB", vehicleType = "spaceship" });
        Assert.Equal((HttpStatusCode)422, response.StatusCode);
    }

    [Fact]
    public async Task unknown_ticket_returns_404_with_code()
    {
        var client = _factory.CreateClient();
        client.WithAdminToken(await TestAuth.LoginAsync(client, "admin", "admin123"));
        var response = await client.GetAsync($"/api/tickets/{Guid.NewGuid()}/quote");
        Assert.Equal(HttpStatusCode.NotFound, response.StatusCode);
        var error = await response.Content.ReadFromJsonAsync<ErrorBody>();
        Assert.Equal(ErrorCodes.TicketNotFound, error!.Code);
    }

    [Fact]
    public async Task admin_only_refund_endpoint_for_attendant_is_403()
    {
        var client = _factory.CreateClient();
        client.WithAdminToken(await TestAuth.LoginAsync(client, "attendant", "attendant123"));
        var response = await client.PostAsync($"/api/payments/{Guid.NewGuid()}/refund", null);
        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task garage_full_under_parallel_load()
    {
        var client = _factory.CreateClient();
        client.WithAdminToken(await TestAuth.LoginAsync(client, "admin", "admin123"));

        // Test config: 10 standard bays. 25 parallel entries compete for them.
        var tasks = Enumerable.Range(0, 25)
            .Select(i => client.PostAsJsonAsync("/api/entries", new { plate = $"AA-{i:D3}-BB", vehicleType = "standard" }))
            .ToList();
        var responses = await Task.WhenAll(tasks);

        var created = responses.Count(r => r.StatusCode == HttpStatusCode.Created);
        var full = responses.Count(r => r.StatusCode == HttpStatusCode.Conflict);
        Assert.Equal(10, created);
        Assert.Equal(15, full);

        var fullError = await responses.First(r => r.StatusCode == HttpStatusCode.Conflict)
            .Content.ReadFromJsonAsync<ErrorBody>();
        Assert.Equal(ErrorCodes.GarageFull, fullError!.Code);

        // Capacity is exactly full after the successful entries.
        var occupancy = await client.GetFromJsonAsync<OccupancyResponse>("/api/admin/occupancy");
        Assert.Equal(10, occupancy!.TotalOccupied);
    }
}

public static class HttpClientExtensions
{
    public static HttpClient WithAdminToken(this HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new("Bearer", token);
        return client;
    }
}
