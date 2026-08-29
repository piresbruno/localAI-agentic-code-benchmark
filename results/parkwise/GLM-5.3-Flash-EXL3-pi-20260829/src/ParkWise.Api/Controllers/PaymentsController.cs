using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using ParkWise.Contracts;
using ParkWise.Services;
using ParkWise.Api.Auth;
using ParkWise.Services.Abstractions;

namespace ParkWise.Api.Controllers;

/// <summary>Payments: settle tickets, fetch receipts, refunds (admin).</summary>
[ApiController]
[Route("api/payments")]
[Authorize(Policy = Roles.AttendantOrAdmin)]
public class PaymentsController(PaymentService payments) : ControllerBase
{
    /// <summary>Pays for a ticket (card|cash|app). Marks the ticket paid and returns the receipt.
    /// Set evChargingUsed=true to add the flat EV charging surcharge (EV tickets only).</summary>
    [HttpPost]
    public async Task<ActionResult<PaymentResponse>> Pay([FromBody] PaymentRequest request, CancellationToken ct)
    {
        var payment = await payments.PayAsync(request.TicketId, request.Method, request.EvChargingUsed, ct);
        return StatusCode(StatusCodes.Status201Created, ToResponse(payment, "Paid"));
    }

    /// <summary>Fetches one payment receipt.</summary>
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<PaymentResponse>> Get(Guid id, CancellationToken ct)
    {
        var payment = await payments.GetAsync(id, ct);
        return Ok(ToResponse(payment, payment.RefundedAtUtc is not null ? "Refunded" : "Paid"));
    }

    /// <summary>Refunds a payment (admin only, within 24h of payment).</summary>
    [HttpPost("{id:guid}/refund")]
    [Authorize(Policy = Roles.AdminOnly)]
    public async Task<ActionResult<PaymentResponse>> Refund(Guid id, CancellationToken ct)
    {
        var payment = await payments.RefundAsync(id, ct);
        return Ok(ToResponse(payment, "Refunded"));
    }

    private static PaymentResponse ToResponse(PaymentRecord payment, string ticketStatus) => new(
        payment.Id, payment.TicketId, payment.Amount, payment.Method.ToString(), "EUR",
        payment.PaidAtUtc, payment.EvChargingUsed, payment.RefundedAtUtc, ticketStatus);
}
