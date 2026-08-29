using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Api.Auth;

namespace ParkWise.Api.Controllers;

/// <summary>Ticket operations that are not entry/exit: fee quote and lost-ticket report.</summary>
[ApiController]
[Route("api/tickets")]
[Authorize(Policy = Roles.AttendantOrAdmin)]
public class TicketsController(TicketService tickets) : ControllerBase
{
    /// <summary>Current fee preview for a ticket — no side effects.</summary>
    [HttpGet("{ticketId:guid}/quote")]
    public async Task<ActionResult<QuoteResponse>> GetQuote(Guid ticketId, CancellationToken ct)
        => Ok(await tickets.GetQuoteAsync(ticketId, ct));

    /// <summary>Reports a physical ticket as lost (flat fee applies). Body must carry the plate.</summary>
    [HttpPost("{ticketId:guid}/report-lost")]
    public async Task<ActionResult<QuoteResponse>> ReportLost(Guid ticketId, [FromBody] LostTicketRequest request, CancellationToken ct)
        => Ok(await tickets.ReportLostAsync(ticketId, request.Plate, ct));
}
