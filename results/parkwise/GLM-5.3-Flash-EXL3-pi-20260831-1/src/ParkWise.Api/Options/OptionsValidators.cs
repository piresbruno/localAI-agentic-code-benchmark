using Microsoft.Extensions.Options;
using ParkWise.Services.Options;

namespace ParkWise.Api.Options;

/// <summary>Shared rule: every listed value must be at least `min`, else boot fails listing offenders.</summary>
internal static class OptionsRules
{
    internal static ValidateOptionsResult FailIfAny(params (string Name, decimal Value, decimal Min)[] rules)
    {
        var errors = rules
            .Where(r => r.Value < r.Min)
            .Select(r => $"{r.Name} must be >= {r.Min} (got {r.Value}).")
            .ToList();
        return errors.Count > 0 ? ValidateOptionsResult.Fail(errors) : ValidateOptionsResult.Success;
    }
}

/// <summary>Boot-time config validation (spec §7): invalid config = clear boot failure.</summary>
public sealed class GarageOptionsValidator : IValidateOptions<GarageOptions>
{
    public ValidateOptionsResult Validate(string? name, GarageOptions options) =>
        OptionsRules.FailIfAny(
            ("Garage:MotorcycleBays", options.MotorcycleBays, 0),
            ("Garage:CompactBays", options.CompactBays, 0),
            ("Garage:StandardBays", options.StandardBays, 0),
            ("Garage:EvBays", options.EvBays, 0));
}

public sealed class FeeOptionsValidator : IValidateOptions<FeeOptions>
{
    public ValidateOptionsResult Validate(string? name, FeeOptions options) =>
        OptionsRules.FailIfAny(
            ("Fees:GraceMinutes", options.GraceMinutes, 0),
            ("Fees:MotorcyclePerHour", options.MotorcyclePerHour, 0.01m),
            ("Fees:CompactPerHour", options.CompactPerHour, 0.01m),
            ("Fees:StandardPerHour", options.StandardPerHour, 0.01m),
            ("Fees:EvPerHour", options.EvPerHour, 0.01m),
            ("Fees:DailyCap", options.DailyCap, 0.01m),
            ("Fees:LostTicketFee", options.LostTicketFee, 0.01m));
}

public sealed class AuthOptionsValidator : IValidateOptions<AuthOptions>
{
    public ValidateOptionsResult Validate(string? name, AuthOptions options)
    {
        var errors = new List<string>();
        if (string.IsNullOrWhiteSpace(options.Secret)) errors.Add("Auth:Secret must be set.");
        if (options.Secret.Length < 16) errors.Add("Auth:Secret must be at least 16 characters.");
        if (options.ExpiryHours <= 0) errors.Add("Auth:ExpiryHours must be > 0.");
        if (options.Users.Length == 0) errors.Add("Auth:Users must contain at least one seeded account.");
        errors.AddRange(options.Users
            .Where(u => string.IsNullOrWhiteSpace(u.Username) || string.IsNullOrWhiteSpace(u.Password))
            .Select(u => $"Auth:Users entry '{u.Username}' must have username and password."));
        errors.AddRange(options.Users
            .Where(u => u.Role is not ("admin" or "attendant"))
            .Select(u => $"Auth:Users entry '{u.Username}' must have role 'admin' or 'attendant'."));
        return errors.Count > 0 ? ValidateOptionsResult.Fail(errors) : ValidateOptionsResult.Success;
    }
}
