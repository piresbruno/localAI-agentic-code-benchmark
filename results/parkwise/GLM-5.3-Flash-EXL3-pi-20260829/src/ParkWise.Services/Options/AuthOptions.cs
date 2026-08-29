using Microsoft.Extensions.Options;

namespace ParkWise.Services.Options;

/// <summary>Authentication configuration.</summary>
public class AuthOptions
{
    public const string SectionName = "Auth";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "ParkWise";
    public string Audience { get; set; } = "ParkWiseApi";
    public int TokenExpiryHours { get; set; } = 8;

    public string AdminUsername { get; set; } = "admin";
    public string AdminPassword { get; set; } = "admin123";
    public string AttendantUsername { get; set; } = "attendant";
    public string AttendantPassword { get; set; } = "attendant123";

    /// <summary>Local dev default; production must set Auth__Secret explicitly.</summary>
    public const string DevelopmentSecret = "parkwise-dev-secret-do-not-use-in-production-0123456789";
}

/// <summary>Validates <see cref="GarageOptions"/> at startup; invalid config fails the boot.</summary>
public class AuthOptionsValidator : IValidateOptions<AuthOptions>
{
    public ValidateOptionsResult Validate(string? name, AuthOptions options)
    {
        var failures = new List<string>();
        if (string.IsNullOrWhiteSpace(options.Secret) || options.Secret.Length < 16)
        {
            failures.Add("Auth:Secret must be set and at least 16 characters long.");
        }
        if (options.TokenExpiryHours is < 1 or > 24)
        {
            failures.Add("Auth:TokenExpiryHours must be between 1 and 24.");
        }
        if (string.IsNullOrWhiteSpace(options.AdminUsername) || string.IsNullOrWhiteSpace(options.AdminPassword))
        {
            failures.Add("Auth:Admin credentials must be configured.");
        }
        if (string.IsNullOrWhiteSpace(options.AttendantUsername) || string.IsNullOrWhiteSpace(options.AttendantPassword))
        {
            failures.Add("Auth:Attendant credentials must be configured.");
        }
        return failures.Count > 0 ? ValidateOptionsResult.Fail(failures) : ValidateOptionsResult.Success;
    }
}
