using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using Microsoft.IdentityModel.Tokens;
using ParkWise.Contracts;
using ParkWise.Services.Options;

namespace ParkWise.Api.Auth;

/// <summary>Issues 8h JWTs for the seeded accounts (spec §5); passwords verified in constant time.</summary>
public sealed class TokenService(AuthOptions auth)
{
    public LoginResponse? Login(string username, string password)
    {
        var user = auth.Users.FirstOrDefault(u =>
            string.Equals(u.Username, username, StringComparison.OrdinalIgnoreCase));
        if (user is null || !FixedTimeEquals(user.Password, password)) return null;

        var claims = new List<Claim>
        {
            new(ClaimTypes.Name, user.Username),
            new(ClaimTypes.Role, user.Role),
        };
        var credentials = new SigningCredentials(
            new SymmetricSecurityKey(System.Text.Encoding.UTF8.GetBytes(auth.Secret)),
            SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: auth.Issuer,
            audience: auth.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(auth.ExpiryHours),
            signingCredentials: credentials);
        return new LoginResponse(new JwtSecurityTokenHandler().WriteToken(token), user.Username, user.Role);
    }

    private static bool FixedTimeEquals(string expected, string actual)
    {
        var a = System.Text.Encoding.UTF8.GetBytes(expected);
        var b = System.Text.Encoding.UTF8.GetBytes(actual);
        return CryptographicOperations.FixedTimeEquals(a, b);
    }
}
