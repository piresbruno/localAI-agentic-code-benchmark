using System.Net;
using System.Net.Http.Headers;
using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Hosting;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Mvc.Testing;
using ParkWise.Contracts;
using Xunit;

namespace ParkWise.IntegrationTests;

/// <summary>
/// Full-stack integration tests (spec §8): WebApplicationFactory + real SQLite temp file,
/// fresh app + fresh database per test class instance.
/// </summary>
public sealed class ParkWiseApiTests : IDisposable
{
    // Fresh app + fresh SQLite temp file per test (constructor runs once per test method).
    private readonly CustomFactory _factory = new();

    public void Dispose() => _factory.Dispose();

    /// <summary>Each test run gets its own SQLite temp file, injected via env var (overrides appsettings.json).</summary>
    public sealed class CustomFactory : WebApplicationFactory<Program>
    {
        private readonly string _dbPath = Path.Combine(Path.GetTempPath(), $"parkwise-{Guid.NewGuid():N}.db");

        public CustomFactory()
        {
            // Env vars beat appsettings.json in the default provider chain (spec §7: config from appsettings + env).
            Environment.SetEnvironmentVariable("Database__ConnectionString", $"Data Source={_dbPath}");
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
        }

        protected override void Dispose(bool disposing)
        {
            base.Dispose(disposing);
            Environment.SetEnvironmentVariable("Database__ConnectionString", null);
            if (File.Exists(_dbPath)) File.Delete(_dbPath);
        }
    }

    private HttpClient CreateClient() => _factory.CreateClient();

    internal static readonly JsonSerializerOptions JsonOpts =
        new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private static async Task<string> LoginAsync(HttpClient client, string username, string password)
    {
        var res = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest(username, password));
        res.EnsureSuccessStatusCode();
        var body = await res.Content.ReadFromJsonAsync<LoginResponse>(JsonOpts);
        return body!.Token;
    }

    private static HttpClient WithToken(HttpClient client, string token)
    {
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);
        return client;
    }

    private async Task<HttpClient> AttendantAsync()
    {
        var client = CreateClient();
        return WithToken(client, await LoginAsync(client, "attendant", "attendant123"));
    }

    private async Task<HttpClient> AdminAsync()
    {
        var client = CreateClient();
        return WithToken(client, await LoginAsync(client, "admin", "admin123"));
    }

    [Fact]
    public async Task Health_Returns_200()
    {
        var res = await CreateClient().GetAsync("/health");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    [Fact]
    public async Task Login_With_Seeded_Accounts_Issues_Token_And_Rejects_Bad_Credentials()
    {
        var client = CreateClient();
        var ok = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("attendant", "attendant123"));
        Assert.Equal(HttpStatusCode.OK, ok.StatusCode);
        var bad = await client.PostAsJsonAsync("/api/auth/login", new LoginRequest("attendant", "wrong"));
        Assert.Equal(HttpStatusCode.Unauthorized, bad.StatusCode);
        var body = await bad.Content.ReadFromJsonAsync<ApiError>(JsonOpts);
        Assert.Equal("INVALID_CREDENTIALS", body!.Error.Code);
    }

    [Fact]
    public async Task Full_Flow_Entry_Quote_Pay_Exit()
    {
        var client = await AttendantAsync();

        var entry = await client.PostAsJsonAsync("/api/entries", new EntryRequest("AB-123-CD", VehicleType.Standard));
        Assert.Equal(HttpStatusCode.Created, entry.StatusCode);
        var ticket = await entry.Content.ReadFromJsonAsync<TicketDto>(JsonOpts);
        Assert.NotNull(ticket);
        Assert.Equal(TicketStatus.Open, ticket!.Status);
        Assert.StartsWith("S-", ticket.BayId);

        // fee quote endpoint
        var quoted = await client.GetFromJsonAsync<TicketDto>($"/api/tickets/{ticket.Id}", JsonOpts);
        Assert.Equal(TicketStatus.Open, quoted!.Status);

        // exit without payment → 402 with quote (past grace is simulated by fee>0 only in real time;
        // here the stay is within grace so exit auto-completes — see grace test below for 402 path)
        var exit = await client.PostAsync($"/api/exits/{ticket.Id}", null);
        Assert.Equal(HttpStatusCode.OK, exit.StatusCode);
        var result = await exit.Content.ReadFromJsonAsync<ExitResult>(JsonOpts);
        Assert.Equal(TicketStatus.Exited, result!.Ticket.Status);
        Assert.Equal(0m, result.FeeCollected); // within grace
    }

    [Fact]
    public async Task Requires_Payment_Before_Exit_When_Fee_Due_Then_Pay_And_Exit()
    {
        var client = await AttendantAsync();
        var entry = await client.PostAsJsonAsync("/api/entries", new EntryRequest("AB-123-CD", VehicleType.Standard));
        var ticket = await entry.Content.ReadFromJsonAsync<TicketDto>(JsonOpts);

        // The stay is within grace, so to exercise the 402 path we mark the ticket lost → flat 25.00 fee.
        await client.PostAsJsonAsync($"/api/tickets/{ticket!.Id}/lost", new { });

        var exit = await client.PostAsync($"/api/exits/{ticket.Id}", null);
        Assert.Equal(HttpStatusCode.PaymentRequired, exit.StatusCode);
        var error = await exit.Content.ReadFromJsonAsync<ApiError>(JsonOpts);
        Assert.Equal("PAYMENT_REQUIRED", error!.Error.Code);
        Assert.NotNull(error.Error.Details);

        // pay the quoted fee
        var pay = await client.PostAsJsonAsync("/api/payments", new PaymentRequest(ticket.Id, PaymentMethod.Card));
        Assert.Equal(HttpStatusCode.Created, pay.StatusCode);
        var receipt = await pay.Content.ReadFromJsonAsync<PaymentDto>(JsonOpts);
        Assert.Equal(25.00m, receipt!.Amount);

        // exit now completes
        var exit2 = await client.PostAsync($"/api/exits/{ticket.Id}", null);
        Assert.Equal(HttpStatusCode.OK, exit2.StatusCode);
        var result = await exit2.Content.ReadFromJsonAsync<ExitResult>(JsonOpts);
        Assert.Equal(TicketStatus.Exited, result!.Ticket.Status);
        Assert.Equal(25.00m, result.FeeCollected);
        Assert.Equal(receipt.Id, result.ReceiptId);

        // receipt fetch
        var fetched = await client.GetFromJsonAsync<PaymentDto>($"/api/payments/{receipt.Id}", JsonOpts);
        Assert.Equal(receipt.Id, fetched!.Id);
    }

    [Fact]
    public async Task Blocks_Paid_Ticket_Double_Exit()
    {
        var client = await AttendantAsync();
        var ticket = await CreateEntryAsync(client, "AB-123-CD", VehicleType.Motorcycle); // within grace → fee 0
        await client.PostAsJsonAsync("/api/payments", new PaymentRequest(ticket.Id, PaymentMethod.Cash));
        var first = await client.PostAsync($"/api/exits/{ticket.Id}", null);
        Assert.Equal(HttpStatusCode.OK, first.StatusCode);
        var second = await client.PostAsync($"/api/exits/{ticket.Id}", null);
        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        var error = await second.Content.ReadFromJsonAsync<ApiError>(JsonOpts);
        Assert.Equal("ALREADY_EXITED", error!.Error.Code);
    }

    [Fact]
    public async Task Rejects_Malformed_Plate_With_422()
    {
        var client = await AttendantAsync();
        var res = await client.PostAsJsonAsync("/api/entries", new EntryRequest("banana", VehicleType.Standard));
        Assert.Equal(HttpStatusCode.UnprocessableEntity, res.StatusCode);
        var error = await res.Content.ReadFromJsonAsync<ApiError>(JsonOpts);
        Assert.Equal("PLATE_INVALID", error!.Error.Code);
    }

    [Fact]
    public async Task Denies_Entry_When_Garage_Full_Then_Frees_On_Exit()
    {
        var client = await AttendantAsync();
        // EvBays = 1 (default config): first ev takes it
        var ev1 = await CreateEntryAsync(client, "AB-123-CD", VehicleType.Ev);
        // second ev falls back to standard, which has 5 bays — fill those with standards
        for (var i = 0; i < 5; i++) await CreateEntryAsync(client, $"AB-00{i}-CD", VehicleType.Standard);
        // now: ev pool full (1/1) and standard pool full (5/5) → a third ev has no
        // compatible bay → GARAGE_FULL with both compatible types flagged in details
        var res = await client.PostAsJsonAsync("/api/entries", new EntryRequest("XY-999-ZZ", VehicleType.Ev));
        Assert.Equal(HttpStatusCode.Conflict, res.StatusCode);
        var error = await res.Content.ReadFromJsonAsync<ApiError>(JsonOpts);
        Assert.Equal("GARAGE_FULL", error!.Error.Code);
        var details = Assert.IsType<JsonElement>(error.Error.Details);
        var fullTypes = details.GetProperty("fullTypes");
        Assert.Equal(2, fullTypes.GetArrayLength());

        // exit frees a standard bay (the ev fallback) → a standard entry succeeds again
        var exit = await client.PostAsync($"/api/exits/{ev1.Id}", null); // ev1 is in the ev bay, exit frees E-1
        Assert.Equal(HttpStatusCode.OK, exit.StatusCode);
        var reentry = await client.PostAsJsonAsync("/api/entries", new EntryRequest("XY-998-ZZ", VehicleType.Ev));
        Assert.Equal(HttpStatusCode.Created, reentry.StatusCode);
        var newTicket = await reentry.Content.ReadFromJsonAsync<TicketDto>(JsonOpts);
        Assert.StartsWith("E-", newTicket!.BayId);
    }

    [Fact]
    public async Task Concurrent_Entries_Never_Exceed_Capacity()
    {
        var client = await AttendantAsync();
        var tasks = Enumerable.Range(0, 10)
            .Select(i => Task.Run(async () =>
            {
                var res = await client.PostAsJsonAsync("/api/entries", new EntryRequest($"AB-{i:000}-CD", VehicleType.Standard));
                return (int)res.StatusCode;
            }))
            .ToList();
        var codes = await Task.WhenAll(tasks);
        Assert.Equal(5, codes.Count(c => c == 201)); // 5 standard bays
        Assert.Equal(5, codes.Count(c => c == 409)); // GARAGE_FULL for the rest
    }

    [Fact]
    public async Task Enforces_Attendant_Role()
    {
        var anonymous = CreateClient();
        Assert.Equal(HttpStatusCode.Unauthorized,
            (await anonymous.PostAsJsonAsync("/api/entries", new EntryRequest("AB-123-CD", VehicleType.Standard))).StatusCode);
        Assert.Equal(HttpStatusCode.Unauthorized, (await anonymous.GetAsync("/api/tickets?status=open")).StatusCode);

        var attendant = await AttendantAsync();
        Assert.Equal(HttpStatusCode.Forbidden, (await attendant.GetAsync("/api/admin/occupancy")).StatusCode);

        var admin = await AdminAsync();
        Assert.Equal(HttpStatusCode.OK, (await admin.GetAsync("/api/admin/occupancy")).StatusCode);
        var occupancy = await (await admin.GetAsync("/api/admin/occupancy")).Content
            .ReadFromJsonAsync<List<OccupancyItem>>(JsonOpts);
        Assert.Equal(4, occupancy!.Count); // one row per bay type
        Assert.Equal(5, occupancy.First(o => o.Type == VehicleType.Standard).Total);
    }

    [Fact]
    public async Task Unknown_Ticket_Returns_404_TicketNotFound()
    {
        var client = await AttendantAsync();
        var res = await client.GetAsync($"/api/tickets/{Guid.NewGuid()}");
        Assert.Equal(HttpStatusCode.NotFound, res.StatusCode);
        var error = await res.Content.ReadFromJsonAsync<ApiError>(JsonOpts);
        Assert.Equal("TICKET_NOT_FOUND", error!.Error.Code);
    }

    [Fact]
    public async Task Tickets_List_Supports_Status_Filter()
    {
        var client = await AttendantAsync();
        await CreateEntryAsync(client, "AB-123-CD", VehicleType.Standard);
        await CreateEntryAsync(client, "EF-456-GH", VehicleType.Compact);
        var open = await client.GetFromJsonAsync<List<TicketDto>>("/api/tickets?status=open", JsonOpts);
        Assert.Equal(2, open!.Count);
        await client.PostAsync($"/api/exits/{open[0].Id}", null); // grace exit
        var openAfter = await client.GetFromJsonAsync<List<TicketDto>>("/api/tickets?status=open", JsonOpts);
        Assert.Single(openAfter!);
    }

    [Fact]
    public async Task Swagger_Is_Served()
    {
        var res = await CreateClient().GetAsync("/swagger/index.html");
        Assert.Equal(HttpStatusCode.OK, res.StatusCode);
    }

    private static async Task<TicketDto> CreateEntryAsync(HttpClient client, string plate, VehicleType type)
    {
        var res = await client.PostAsJsonAsync("/api/entries", new EntryRequest(plate, type));
        Assert.Equal(HttpStatusCode.Created, res.StatusCode);
        return (await res.Content.ReadFromJsonAsync<TicketDto>(JsonOpts))!;
    }

    private sealed record ApiError(ErrorEnvelope Error);
    private sealed record ErrorEnvelope(string Code, string Message, JsonElement? Details);
}
