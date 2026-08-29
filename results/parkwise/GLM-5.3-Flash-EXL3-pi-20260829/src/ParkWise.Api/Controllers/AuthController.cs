using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;

namespace ParkWise.Api.Controllers;

/// <summary>Authentication: operator login.</summary>
[ApiController]
[Route("api/auth")]
public class AuthController(AuthService auth) : ControllerBase
{
    /// <summary>Log in as attendant or admin; returns a JWT.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request, CancellationToken ct)
    {
        var response = await auth.LoginAsync(request.Username, request.Password, ct);
        return Ok(response);
    }
}
