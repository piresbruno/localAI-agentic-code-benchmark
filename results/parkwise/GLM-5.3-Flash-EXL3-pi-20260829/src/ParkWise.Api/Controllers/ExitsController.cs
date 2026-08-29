using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Api.Auth;

namespace ParkWise.Api.Controllers;

/// <summary>Exit processing: quote if unpaid, complete when paid/grace.</summary>
[ApiController]
[Route("api/exits")]
[Authorize(Policy = Roles.AttendantOrAdmin)]
public class ExitsController(TicketService tickets) : ControllerBase
{
    /// <summary>Processes an exit for a ticket. Returns 402 PAYMENT_REQUIRED with the fee
    /// quote when payment is due; 409 ALREADY_EXITED on double exit; completes the stay
    /// (and frees the bay) when paid or within the grace window.</summary>
    [HttpPost("{ticketId:guid}")]
    public async Task<ActionResult<QuoteResponse>> ProcessExit(Guid ticketId, CancellationToken ct)
    {
        var quote = await tickets.ProcessExitAsync(ticketId, ct);
        return Ok(quote);
    }
}
