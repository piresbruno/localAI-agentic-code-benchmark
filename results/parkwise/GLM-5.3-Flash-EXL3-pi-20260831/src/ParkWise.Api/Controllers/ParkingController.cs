using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;

namespace ParkWise.Api.Controllers;

/// <summary>Entry/exit/payment/ticket endpoints — attendant or admin role (spec §4/§5).</summary>
[ApiController]
[Route("api")]
[Authorize] // role checks per-route below; services enforce nothing role-related
public sealed class ParkingController(IParkingService parking) : ControllerBase
{
    private const string AttendantOrAdmin = "attendant,admin";

    /// <summary>Register a vehicle entry; issues a ticket and allocates a compatible bay.</summary>
    [HttpPost("entries")]
    [Authorize(Roles = AttendantOrAdmin)]
    [ProducesResponseType(typeof(TicketDto), StatusCodes.Status201Created)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    [ProducesResponseType(StatusCodes.Status422UnprocessableEntity)]
    public async Task<IActionResult> RegisterEntry([FromBody] EntryRequest request, CancellationToken ct)
    {
        var ticket = await parking.RegisterEntryAsync(request.Plate, request.VehicleType, ct);
        return CreatedAtAction(nameof(GetTicket), new { ticketId = ticket.Id }, ticket);
    }

    /// <summary>List tickets, optionally filtered by status (`?status=open`).</summary>
    [HttpGet("tickets")]
    [Authorize(Roles = AttendantOrAdmin)]
    [ProducesResponseType(typeof(IReadOnlyList<TicketDto>), StatusCodes.Status200OK)]
    public async Task<IActionResult> ListTickets([FromQuery] string? status, CancellationToken ct)
    {
        TicketStatus? parsed = status?.ToLowerInvariant() switch
        {
            "open" => TicketStatus.Open,
            "paid" => TicketStatus.Paid,
            "exited" => TicketStatus.Exited,
            "lost" => TicketStatus.Lost,
            null or "" => null,
            _ => throw new AppException(ErrorCodes.ValidationError, 400, $"Unknown status '{status}'."),
        };
        return Ok(await parking.ListTicketsAsync(parsed, ct));
    }

    /// <summary>Ticket details with the current live fee quote.</summary>
    [HttpGet("tickets/{ticketId}")]
    [Authorize(Roles = AttendantOrAdmin)]
    [ProducesResponseType(typeof(TicketDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetTicket(string ticketId, CancellationToken ct) =>
        Ok(await parking.GetTicketAsync(ticketId, ct));

    /// <summary>Report a lost ticket — switches the fee to the flat lost-ticket rate.</summary>
    [HttpPost("tickets/{ticketId}/lost")]
    [Authorize(Roles = AttendantOrAdmin)]
    [ProducesResponseType(typeof(TicketDto), StatusCodes.Status200OK)]
    public async Task<IActionResult> MarkLost(string ticketId, CancellationToken ct) =>
        Ok(await parking.MarkLostAsync(ticketId, ct));

    /// <summary>Exit: completes when paid or within grace; 402 with the fee quote otherwise.</summary>
    [HttpPost("exits/{ticketId}")]
    [Authorize(Roles = AttendantOrAdmin)]
    [ProducesResponseType(typeof(ExitResult), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status402PaymentRequired)]
    [ProducesResponseType(StatusCodes.Status409Conflict)]
    public async Task<IActionResult> Exit(string ticketId, CancellationToken ct) =>
        Ok(await parking.RequestExitAsync(ticketId, ct));

    /// <summary>Pay the current fee for a ticket; returns the receipt.</summary>
    [HttpPost("payments")]
    [Authorize(Roles = AttendantOrAdmin)]
    [ProducesResponseType(typeof(PaymentDto), StatusCodes.Status201Created)]
    public async Task<IActionResult> Pay([FromBody] PaymentRequest request, CancellationToken ct)
    {
        var receipt = await parking.PayAsync(request.TicketId, request.Method, ct);
        return CreatedAtAction(nameof(GetPayment), new { paymentId = receipt.Id }, receipt);
    }

    /// <summary>Fetch a receipt by id.</summary>
    [HttpGet("payments/{paymentId}")]
    [Authorize(Roles = AttendantOrAdmin)]
    [ProducesResponseType(typeof(PaymentDto), StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status404NotFound)]
    public async Task<IActionResult> GetPayment(string paymentId, CancellationToken ct) =>
        Ok(await parking.GetPaymentAsync(paymentId, ct));

    /// <summary>Per-bay-type occupancy — admin only (spec §4).</summary>
    [HttpGet("admin/occupancy")]
    [Authorize(Roles = "admin")]
    [ProducesResponseType(typeof(IReadOnlyList<OccupancyItem>), StatusCodes.Status200OK)]
    public async Task<IActionResult> Occupancy(CancellationToken ct) =>
        Ok(await parking.GetOccupancyAsync(ct));
}
