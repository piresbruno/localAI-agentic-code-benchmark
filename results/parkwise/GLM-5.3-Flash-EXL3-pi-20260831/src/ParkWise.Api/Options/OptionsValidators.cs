using Microsoft.Extensions.Options;
using ParkWise.Services.Options;

namespace ParkWise.Api.Options;

/// <summary>Boot-time config validation (spec §7): invalid config = clear boot failure.</summary>
public sealed class GarageOptionsValidator : IValidateOptions<GarageOptions>
{
    public ValidateOptionsResult Validate(string? name, GarageOptions options)
    {
        var errors = new List<string>();
        foreach (var (name2, count) in new (string, int)[]
                 {
                     ("MotorcycleBays", options.MotorcycleBays),
                     ("CompactBays", options.CompactBays),
                     ("StandardBays", options.StandardBays),
                     ("EvBays", options.EvBays),
                 })
        {
            if (count < 0) errors.Add($"Garage:{name2} must be >= 0 (got {count}).");
        }
        return errors.Count > 0 ? ValidateOptionsResult.Fail(errors) : ValidateOptionsResult.Success;
    }
}

public sealed class FeeOptionsValidator : IValidateOptions<FeeOptions>
{
    public ValidateOptionsResult Validate(string? name, FeeOptions options)
    {
        var errors = new List<string>();
        if (options.GraceMinutes < 0) errors.Add("Fees:GraceMinutes must be >= 0.");
        if (options.DailyCap <= 0) errors.Add("Fees:DailyCap must be > 0.");
        if (options.LostTicketFee <= 0) errors.Add("Fees:LostTicketFee must be > 0.");
        foreach (var (rateName, rate) in new (string, decimal)[]
                 {
                     ("MotorcyclePerHour", options.MotorcyclePerHour),
                     ("CompactPerHour", options.CompactPerHour),
                     ("StandardPerHour", options.StandardPerHour),
                     ("EvPerHour", options.EvPerHour),
                 })
        {
            if (rate <= 0) errors.Add($"Fees:{rateName} must be > 0.");
        }
        return errors.Count > 0 ? ValidateOptionsResult.Fail(errors) : ValidateOptionsResult.Success;
    }
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
        foreach (var user in options.Users)
        {
            if (string.IsNullOrWhiteSpace(user.Username) || string.IsNullOrWhiteSpace(user.Password))
                errors.Add($"Auth:Users entry '{user.Username}' must have username and password.");
            if (user.Role is not ("admin" or "attendant"))
                errors.Add($"Auth:Users entry '{user.Username}' must have role 'admin' or 'attendant'.");
        }
        return errors.Count > 0 ? ValidateOptionsResult.Fail(errors) : ValidateOptionsResult.Success;
    }
}
