using ParkWise.Services.Abstractions;

namespace ParkWise.Services;

/// <summary>PBKDF2 (.NET built-in) password hashing. Format: pbkdf2:iterations:saltHex:hashHex.</summary>
public sealed class Pbkdf2PasswordHasher : IPasswordHasher
{
    private const int Iterations = 100_000;
    private const int SaltSize = 16;
    private const int HashSize = 32;

    public string Hash(string password)
    {
        var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(SaltSize);
        var hash = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(password, salt, Iterations, System.Security.Cryptography.HashAlgorithmName.SHA256, HashSize);
        return $"pbkdf2:{Iterations}:{Convert.ToHexString(salt)}:{Convert.ToHexString(hash)}";
    }

    public bool Verify(string password, string storedHash)
    {
        var parts = storedHash.Split(':');
        if (parts.Length != 4 || parts[0] != "pbkdf2" || !int.TryParse(parts[1], out var iterations))
        {
            return false;
        }
        var salt = Convert.FromHexString(parts[2]);
        var expected = Convert.FromHexString(parts[3]);
        var actual = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(password, salt, iterations, System.Security.Cryptography.HashAlgorithmName.SHA256, expected.Length);
        return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(expected, actual);
    }
}
