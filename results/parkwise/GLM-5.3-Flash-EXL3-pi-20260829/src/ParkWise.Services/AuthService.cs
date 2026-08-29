using ParkWise.Contracts;
using ParkWise.Services.Abstractions;

namespace ParkWise.Services;

/// <summary>Operator login validation. Token issuance is an infrastructure concern
/// (ITokenService implementation lives in the API host).</summary>
public class AuthService
{
    private readonly IOperatorRepository _operators;
    private readonly IPasswordHasher _hasher;
    private readonly ITokenService _tokens;

    public AuthService(IOperatorRepository operators, IPasswordHasher hasher, ITokenService tokens)
    {
        _operators = operators;
        _hasher = hasher;
        _tokens = tokens;
    }

    /// <summary>Validates credentials and issues a JWT. Fails with UnauthorizedException on
    /// bad credentials (uniform message — no user enumeration).</summary>
    public async Task<AuthResponse> LoginAsync(string username, string password, CancellationToken ct = default)
    {
        var user = await _operators.GetByUsernameAsync(username?.Trim() ?? string.Empty, ct);
        if (user is null || !_hasher.Verify(password ?? string.Empty, user.PasswordHash))
        {
            throw new UnauthorizedException();
        }
        return new AuthResponse(_tokens.Issue(user), user.Username, user.Role);
    }
}

/// <summary>PBKDF2 password hashing abstraction.</summary>
public interface IPasswordHasher
{
    string Hash(string password);
    bool Verify(string password, string storedHash);
}

/// <summary>JWT issuance abstraction (implemented with System.IdentityModel tokens in the host).</summary>
public interface ITokenService
{
    string Issue(OperatorRecord user);
}
