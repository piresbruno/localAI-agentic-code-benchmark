namespace ParkWise.Data.Entities;

/// <summary>Operator account for the API (attendant or admin).</summary>
public class OperatorUser
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Role { get; set; } = "attendant";
    /// <summary>PBKDF2 hash in the form iterations:salt:hash (hex).</summary>
    public string PasswordHash { get; set; } = string.Empty;
}
