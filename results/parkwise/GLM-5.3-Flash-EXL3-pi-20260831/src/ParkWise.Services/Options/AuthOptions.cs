using ParkWise.Contracts;
namespace ParkWise.Services.Options;

/// <summary>JWT + seeded account configuration (spec §7), bound from appsettings/env.</summary>
public sealed class AuthOptions
{
    public string Secret { get; init; } = string.Empty;
    public string Issuer { get; init; } = "ParkWise";
    public string Audience { get; init; } = "ParkWise";
    /// <summary>JWT lifetime in hours (spec: 8h).</summary>
    public int ExpiryHours { get; init; } = 8;

    public SeededUser[] Users { get; init; } = [];

    public sealed record SeededUser(string Username, string Password, string Role);
}
