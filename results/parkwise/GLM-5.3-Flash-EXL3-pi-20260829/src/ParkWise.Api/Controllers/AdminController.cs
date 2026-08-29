using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Api.Auth;

namespace ParkWise.Api.Controllers;

/// <summary>Admin endpoints: occupancy and revenue reports.</summary>
[ApiController]
[Route("api/admin")]
[Authorize(Policy = Roles.AdminOnly)]
public class AdminController(ReportService reports) : ControllerBase
{
    /// <summary>Current per-type occupancy of the garage.</summary>
    [HttpGet("occupancy")]
    public async Task<ActionResult<OccupancyResponse>> Occupancy(CancellationToken ct)
        => Ok(await reports.OccupancyAsync(ct));

    /// <summary>Daily revenue report between two ISO dates (from inclusive, to exclusive).</summary>
    [HttpGet("revenue/daily")]
    public async Task<ActionResult<RevenueReportResponse>> RevenueDaily(
        [FromQuery] DateTime from, [FromQuery] DateTime to, CancellationToken ct)
        => Ok(await reports.RevenueDailyAsync(from, to, ct));
}
