using Microsoft.Extensions.Options;

namespace ParkWise.Services.Options;

public class GarageOptionsValidator : IValidateOptions<GarageOptions>
{
    public ValidateOptionsResult Validate(string? name, GarageOptions options)
    {
        var failures = new List<string>();
        if (options.Levels is < 1 or > 3)
        {
            failures.Add($"Garage:Levels must be between 1 and 3 (got {options.Levels}).");
        }
        if (options.Bays.Count == 0)
        {
            failures.Add("Garage:Bays must define at least one bay specification.");
        }
        var validTypes = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            { "motorcycle", "compact", "standard", "ev" };
        foreach (var bay in options.Bays)
        {
            if (bay.Level < 1 || bay.Level > options.Levels)
            {
                failures.Add($"Garage:Bays level {bay.Level} is outside 1..{options.Levels}.");
            }
            if (!validTypes.Contains(bay.Type))
            {
                failures.Add($"Garage:Bays type '{bay.Type}' is not a valid bay type.");
            }
            if (bay.Count < 0)
            {
                failures.Add($"Garage:Bays count for level {bay.Level}/{bay.Type} must be >= 0.");
            }
        }
        if (options.Bays.Sum(b => b.Count) <= 0)
        {
            failures.Add("Garage:Bays must contain at least one bay in total.");
        }
        return failures.Count > 0 ? ValidateOptionsResult.Fail(failures) : ValidateOptionsResult.Success;
    }
}

/// <summary>Validates <see cref="FeeOptions"/> at startup.</summary>
public class FeeOptionsValidator : IValidateOptions<FeeOptions>
{
    public ValidateOptionsResult Validate(string? name, FeeOptions options)
    {
        var failures = new List<string>();
        if (options.GraceMinutes < 0)
        {
            failures.Add("Fees:GraceMinutes must be >= 0.");
        }
        foreach (var (name2, rate) in new[]
                 {
                     ("MotorcycleRatePerHour", options.MotorcycleRatePerHour),
                     ("CompactRatePerHour", options.CompactRatePerHour),
                     ("StandardRatePerHour", options.StandardRatePerHour),
                     ("EvRatePerHour", options.EvRatePerHour),
                 })
        {
            if (rate < 0)
            {
                failures.Add($"Fees:{name2} must be >= 0.");
            }
        }
        if (options.DailyCap < 0)
        {
            failures.Add("Fees:DailyCap must be >= 0.");
        }
        if (options.LostTicketFee < 0)
        {
            failures.Add("Fees:LostTicketFee must be >= 0.");
        }
        if (options.EvChargingSurcharge < 0)
        {
            failures.Add("Fees:EvChargingSurcharge must be >= 0.");
        }
        if (options.RefundWindowHours < 0)
        {
            failures.Add("Fees:RefundWindowHours must be >= 0.");
        }
        return failures.Count > 0 ? ValidateOptionsResult.Fail(failures) : ValidateOptionsResult.Success;
    }
}

/// <summary>Validates <see cref="AuthOptions"/> at startup.</summary>
