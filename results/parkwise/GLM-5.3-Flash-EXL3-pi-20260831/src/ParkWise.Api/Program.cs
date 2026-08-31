using System.Text;
using System.Text.Json.Serialization;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ParkWise.Api.Auth;
using ParkWise.Api.Middleware;
using ParkWise.Api.Options;
using ParkWise.Data;
using ParkWise.Data.Repositories;
using ParkWise.Services;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;

var builder = WebApplication.CreateBuilder(args);

// ---------- Options pattern with startup validation (spec §7) ----------
builder.Services
    .AddOptions<GarageOptions>()
    .Bind(builder.Configuration.GetSection("Garage"))
    .ValidateOnStart();
builder.Services
    .AddOptions<FeeOptions>()
    .Bind(builder.Configuration.GetSection("Fees"))
    .ValidateOnStart();
builder.Services
    .AddOptions<AuthOptions>()
    .Bind(builder.Configuration.GetSection("Auth"))
    .ValidateOnStart();
builder.Services.AddSingleton<IValidateOptions<GarageOptions>, GarageOptionsValidator>();
builder.Services.AddSingleton<IValidateOptions<FeeOptions>, FeeOptionsValidator>();
builder.Services.AddSingleton<IValidateOptions<AuthOptions>, AuthOptionsValidator>();
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<GarageOptions>>().Value);
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<FeeOptions>>().Value);
builder.Services.AddSingleton<AuthOptions>(sp => sp.GetRequiredService<IOptions<AuthOptions>>().Value);

// ---------- Data (SQLite, schema auto-created on boot) ----------
var connectionString = builder.Configuration.GetSection("Database").GetValue<string>("ConnectionString")
                       ?? "Data Source=parkwise.db";
builder.Services.AddDbContext<AppDbContext>(options => options.UseSqlite(connectionString));
builder.Services.AddScoped<ITicketRepository, EfTicketRepository>();
builder.Services.AddScoped<IPaymentRepository, EfPaymentRepository>();

// ---------- Services (pure business logic) ----------
builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<IFeeCalculator, FeeCalculator>();
builder.Services.AddSingleton<SemaphoreSlim>(_ => new SemaphoreSlim(1, 1));
builder.Services.AddScoped<IParkingService, ParkingService>();

// ---------- Auth (JWT, 8h) ----------
var auth = builder.Configuration.GetSection("Auth").Get<AuthOptions>()!;
builder.Services.AddSingleton(new TokenService(auth));
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = auth.Issuer,
            ValidateAudience = true,
            ValidAudience = auth.Audience,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(auth.Secret)),
            ValidateLifetime = true,
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddControllers().AddJsonOptions(options =>
{
    options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo { Title = "ParkWise API", Version = "v1" });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "JWT from POST /api/auth/login",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme { Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" } },
            Array.Empty<string>()
        },
    });
});

var app = builder.Build();

// Auto-create schema on boot (spec §2 — no manual migration step).
using (var scope = app.Services.CreateScope())
{
    scope.ServiceProvider.GetRequiredService<AppDbContext>().Database.EnsureCreated();
}

app.UseMiddleware<ErrorHandlingMiddleware>();
app.UseDefaultFiles(); // serves wwwroot/index.html at /
app.UseStaticFiles();
app.UseAuthentication();
app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
}
app.UseSwaggerUI();

app.MapControllers();
app.MapGet("/health", () => Results.Json(new { status = "ok" }));
app.MapGet("/api/health", () => Results.Json(new { status = "ok" }));

// SPA-ish fallback: unknown non-API GETs serve the console shell.
app.MapFallbackToFile("index.html");

app.Run();

/// <summary>Exposed for WebApplicationFactory in integration tests.</summary>
public partial class Program;
