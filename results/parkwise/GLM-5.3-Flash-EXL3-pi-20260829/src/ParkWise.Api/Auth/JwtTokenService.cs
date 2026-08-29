using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using ParkWise.Services;
using ParkWise.Services.Abstractions;
using ParkWise.Services.Options;

namespace ParkWise.Api.Auth;

/// <summary>JWT issuance (8h expiry by default, config-driven). Infrastructure concern,
/// injected into the domain-facing AuthService.</summary>
public sealed class JwtTokenService : ITokenService
{
    private readonly AuthOptions _options;

    public JwtTokenService(AuthOptions options) => _options = options;

    public string Issue(OperatorRecord user)
    {
        var claims = new[]
        {
            new Claim(ClaimTypes.Name, user.Username),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim(JwtRegisteredClaimNames.Sub, user.Username),
            new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
        };

        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_options.Secret));
        var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
        var token = new JwtSecurityToken(
            issuer: _options.Issuer,
            audience: _options.Audience,
            claims: claims,
            expires: DateTime.UtcNow.AddHours(_options.TokenExpiryHours),
            signingCredentials: credentials);
        return new JwtSecurityTokenHandler().WriteToken(token);
    }
}

/// <summary>Role constants used in authorization policies.</summary>
public static class Roles
{
    public const string Admin = "admin";
    public const string Attendant = "attendant";

    public const string AttendantOrAdmin = "AttendantOrAdmin";
    public const string AdminOnly = "AdminOnly";
}
