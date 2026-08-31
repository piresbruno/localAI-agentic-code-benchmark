using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Api.Auth;
using ParkWise.Contracts;

namespace ParkWise.Api.Controllers;

[ApiController]
[Route("api/auth")]
public sealed class AuthController(TokenService tokens) : ControllerBase
{
    /// <summary>Login with a seeded account; returns an 8h JWT.</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    [ProducesResponseType(typeof(LoginResponse), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public IActionResult Login([FromBody] LoginRequest request)
    {
        var response = tokens.Login(request.Username, request.Password);
        if (response is null)
        {
            return Unauthorized(new { error = new { code = ErrorCodes.InvalidCredentials, message = "Invalid username or password." } });
        }
        return Ok(response);
    }
}
