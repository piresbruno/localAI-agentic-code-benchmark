using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Api.Auth;

namespace ParkWise.Api.Controllers;

/// <summary>Permit management. Mutations and listing are admin-only;
/// validation lookup is available to attendants.</summary>
[ApiController]
[Route("api/permits")]
public class PermitsController(PermitService permits) : ControllerBase
{
    /// <summary>Creates a permit (admin).</summary>
    [HttpPost]
    [Authorize(Policy = Roles.AdminOnly)]
    public async Task<ActionResult<PermitResponse>> Create([FromBody] PermitRequest request, CancellationToken ct)
    {
        var permit = await permits.CreateAsync(request.Code, request.Plate, request.ValidFrom, request.ValidUntil, ct);
        var response = new PermitResponse(permit.Code, permit.Plate, permit.ValidFromUtc, permit.ValidUntilUtc, Active: true);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Lists all permits (admin).</summary>
    [HttpGet]
    [Authorize(Policy = Roles.AdminOnly)]
    public async Task<ActionResult<IReadOnlyList<PermitResponse>>> List(CancellationToken ct)
        => Ok(await permits.ListAsync(ct));

    /// <summary>Validates whether a plate is covered by an active permit (attendant).</summary>
    [HttpGet("validate")]
    [Authorize(Policy = Roles.AttendantOrAdmin)]
    public async Task<ActionResult<PermitValidationResponse>> Validate([FromQuery] string plate, CancellationToken ct)
        => Ok(await permits.ValidateAsync(plate, ct));

    /// <summary>Deletes a permit by code (admin).</summary>
    [HttpDelete("{code}")]
    [Authorize(Policy = Roles.AdminOnly)]
    public async Task<IActionResult> Delete(string code, CancellationToken ct)
    {
        await permits.DeleteAsync(code, ct);
        return NoContent();
    }
}
