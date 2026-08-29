using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Api.Auth;
using ParkWise.Services.Abstractions;

namespace ParkWise.Api.Controllers;

/// <summary>Entry ticketing: register vehicles into the garage.</summary>
[ApiController]
[Route("api/entries")]
[Authorize(Policy = Roles.AttendantOrAdmin)]
public class EntriesController(TicketService tickets) : ControllerBase
{
    /// <summary>Registers a vehicle entry and allocates a compatible bay.
    /// Returns 409 GARAGE_FULL (with full types in details) or 422 for a malformed plate.</summary>
    [HttpPost]
    public async Task<ActionResult<TicketResponse>> RegisterEntry([FromBody] EntryRequest request, CancellationToken ct)
    {
        var result = await tickets.RegisterEntryAsync(request.Plate, request.VehicleType, request.PermitCode, ct);
        var response = new TicketResponse(
            result.Ticket.Id, result.Ticket.Plate, result.Ticket.VehicleType.ToString(),
            result.Ticket.BayId, result.Bay.Type.ToString(), result.Bay.Level,
            result.Ticket.EntryAtUtc, result.Ticket.Status.ToString(), result.Ticket.PermitCode);
        return StatusCode(StatusCodes.Status201Created, response);
    }

    /// <summary>Fetches one ticket by id (404 when unknown).</summary>
    [HttpGet("{ticketId:guid}")]
    public async Task<ActionResult<TicketResponse>> GetTicket(Guid ticketId, CancellationToken ct)
    {
        var ticket = await tickets.GetTicketAsync(ticketId, ct);
        return Ok(ToResponse(ticket));
    }

    internal static TicketResponse ToResponse(TicketRecord ticket) => new(
        ticket.Id, ticket.Plate, ticket.VehicleType.ToString(),
        ticket.BayId, ticket.BayType, ticket.Level,
        ticket.EntryAtUtc, ticket.Status.ToString(), ticket.PermitCode);
}
