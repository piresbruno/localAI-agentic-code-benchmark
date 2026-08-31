using System.Text.RegularExpressions;
using ParkWise.Contracts;

namespace ParkWise.Services.Domain;

/// <summary>
/// A parking ticket. Domain type owning its invariants: the constructor rejects invalid state
/// (malformed plates) and status transitions are guarded, so illegal lifecycles cannot exist.
/// </summary>
public sealed class Ticket
{
    public static readonly Regex PlateRegex = new("^[A-Z]{2}-\\d{3}-[A-Z]{2}$", RegexOptions.Compiled);

    public Guid Id { get; private set; }
    public string Plate { get; private set; } = null!;
    public VehicleType VehicleType { get; private set; }
    /// <summary>Allocated bay, e.g. `S-3` (type letter + slot number).</summary>
    public string BayId { get; private set; } = null!;
    public VehicleType BayType { get; private set; }
    public DateTime EntryAtUtc { get; private set; }
    public TicketStatus Status { get; private set; }

    private Ticket() { } // EF

    public static Ticket Create(string plate, VehicleType vehicleType, string bayId, VehicleType bayType, DateTime entryAtUtc)
    {
        var normalized = plate?.Trim().ToUpperInvariant() ?? string.Empty;
        if (!PlateRegex.IsMatch(normalized))
        {
            throw new AppException(
                ErrorCodes.PlateInvalid, 422,
                "Plate must match the format AA-000-BB (two letters, three digits, two letters).",
                new Dictionary<string, object?> { ["issues"] = new[] { new { field = "plate", message = "Invalid plate format." } } });
        }
        if (string.IsNullOrWhiteSpace(bayId)) throw new AppException(ErrorCodes.ValidationError, 400, "A bay must be allocated.");

        return new Ticket
        {
            Id = Guid.NewGuid(),
            Plate = normalized,
            VehicleType = vehicleType,
            BayId = bayId,
            BayType = bayType,
            EntryAtUtc = entryAtUtc,
            Status = TicketStatus.Open,
        };
    }

    public PaymentReceipt MarkPaid(decimal amount, PaymentMethod method, DateTime paidAtUtc)
    {
        if (Status is TicketStatus.Paid) throw new AppException(ErrorCodes.TicketAlreadyPaid, 409, "This ticket is already paid.");
        if (Status is TicketStatus.Exited) throw new AppException(ErrorCodes.AlreadyExited, 409, "This ticket has already exited.");
        Status = TicketStatus.Paid;
        return new PaymentReceipt(Id, amount, method, paidAtUtc);
    }

    public void MarkLost()
    {
        if (Status is TicketStatus.Exited) throw new AppException(ErrorCodes.AlreadyExited, 409, "This ticket has already exited.");
        if (Status is TicketStatus.Lost) throw new AppException(ErrorCodes.ValidationError, 409, "This ticket is already marked lost.");
        Status = TicketStatus.Lost;
    }

    public void MarkExited()
    {
        if (Status is TicketStatus.Exited) throw new AppException(ErrorCodes.AlreadyExited, 409, "This ticket has already exited.");
        Status = TicketStatus.Exited;
    }
}
