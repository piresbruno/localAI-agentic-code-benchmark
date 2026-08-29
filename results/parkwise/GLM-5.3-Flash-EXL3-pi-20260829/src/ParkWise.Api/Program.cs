using System.Data;
using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using ParkWise.Api.Auth;
using ParkWise.Api.Middleware;
using ParkWise.Data;
using ParkWise.Data.Repositories;
using ParkWise.Services;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Fees;
using ParkWise.Services.Options;

var builder = WebApplication.CreateBuilder(args);

// ---------- Options pattern: bind + validate at startup (invalid config = boot failure) ----------
builder.Services
    .AddOptions<GarageOptions>()
    .Bind(builder.Configuration.GetSection(GarageOptions.SectionName))
    .ValidateOnStart();
builder.Services
    .AddOptions<FeeOptions>()
    .Bind(builder.Configuration.GetSection(FeeOptions.SectionName))
    .ValidateOnStart();
builder.Services
    .AddOptions<AuthOptions>()
    .Bind(builder.Configuration.GetSection(AuthOptions.SectionName))
    .ValidateOnStart();

builder.Services.AddSingleton<IValidateOptions<GarageOptions>, GarageOptionsValidator>();
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<GarageOptions>>().Value);
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<FeeOptions>>().Value);
builder.Services.AddSingleton(sp => sp.GetRequiredService<IOptions<AuthOptions>>().Value);
builder.Services.AddSingleton<IValidateOptions<FeeOptions>, FeeOptionsValidator>();
builder.Services.AddSingleton<IValidateOptions<AuthOptions>, AuthOptionsValidator>();

// Local dev default so a clean checkout boots without configuration; production
// must set Auth__Secret explicitly (documented in README).
if (string.IsNullOrWhiteSpace(builder.Configuration["Auth:Secret"]))
{
    builder.Configuration["Auth:Secret"] = AuthOptions.DevelopmentSecret;
}

// ---------- Database (SQLite inside the run directory by default) ----------
var databasePath = builder.Configuration["Database:Path"] ?? Path.Combine(AppContext.BaseDirectory, "parkwise.db");
Directory.CreateDirectory(Path.GetDirectoryName(databasePath)!);
builder.Services.AddDbContext<ParkWiseDbContext>(options =>
    options.UseSqlite($"Data Source={databasePath}"));

// ---------- Services (business logic) + repositories (EF) ----------
builder.Services.AddScoped<ITicketRepository, EfTicketRepository>();
builder.Services.AddScoped<IBayRepository, EfBayRepository>();
builder.Services.AddScoped<IPaymentRepository, EfPaymentRepository>();
builder.Services.AddScoped<IPermitRepository, EfPermitRepository>();
builder.Services.AddScoped<IOperatorRepository, EfOperatorRepository>();

builder.Services.AddSingleton<IClock, SystemClock>();
builder.Services.AddSingleton<IPasswordHasher, Pbkdf2PasswordHasher>();
builder.Services.AddSingleton<ITokenService, JwtTokenService>(
    sp => new JwtTokenService(sp.GetRequiredService<IOptions<AuthOptions>>().Value));
builder.Services.AddSingleton<FeeCalculator>();
builder.Services.AddSingleton<IFeeCalculator>(sp => sp.GetRequiredService<FeeCalculator>());

builder.Services.AddScoped<TicketService>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddScoped<PermitService>();
builder.Services.AddScoped<ReportService>();
builder.Services.AddScoped<AuthService>(sp => new AuthService(
    sp.GetRequiredService<IOperatorRepository>(),
    sp.GetRequiredService<IPasswordHasher>(),
    sp.GetRequiredService<ITokenService>()));

// ---------- AuthN/AuthZ ----------
builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var auth = builder.Configuration
            .GetSection(AuthOptions.SectionName)
            .Get<AuthOptions>() ?? new AuthOptions();
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

builder.Services.AddAuthorization(options =>
{
    options.AddPolicy(Roles.AttendantOrAdmin, policy => policy
        .RequireAuthenticatedUser()
        .RequireRole(Roles.Attendant, Roles.Admin));
    options.AddPolicy(Roles.AdminOnly, policy => policy
        .RequireAuthenticatedUser()
        .RequireRole(Roles.Admin));
});

builder.Services.AddControllers();
// Validation failures map onto the shared error envelope.
builder.Services.Configure<ApiBehaviorOptions>(options =>
{
    options.InvalidModelStateResponseFactory = context => context.ToErrorBody();
});
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "ParkWise API",
        Version = "1.0.0",
        Description = "Parking garage management API: entry/exit ticketing, fees, payments, permits, reports.",
    });
    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT",
        Description = "Log in via /api/auth/login and paste the JWT here.",
    });
    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference { Type = ReferenceType.SecurityScheme, Id = "Bearer" },
            },
            Array.Empty<string>()
        },
    });
});

var app = builder.Build();

// ---------- Database init: schema + idempotent seed (auto-migrate on boot) ----------
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<ParkWiseDbContext>();
    db.Database.EnsureCreated();
    await DbSeeder.SeedAsync(
        db,
        scope.ServiceProvider.GetRequiredService<IOptions<GarageOptions>>().Value,
        scope.ServiceProvider.GetRequiredService<IOptions<AuthOptions>>().Value,
        scope.ServiceProvider.GetRequiredService<IPasswordHasher>());
}

app.UseErrorHandling();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();
app.UseSwagger();
app.UseSwaggerUI(options => options.SwaggerEndpoint("/swagger/v1/swagger.json", "ParkWise API v1"));

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.Run();

/// <summary>Exposed for WebApplicationFactory-based integration tests.</summary>
public partial class Program;
