using ParkWise.Contracts;

namespace ParkWise.Data.Entities;

/// <summary>A physical parking bay on one level.</summary>
public class Bay
{
    public Guid Id { get; set; }
    public int Level { get; set; }
    public BayType Type { get; set; }
    public BayStatus Status { get; set; }
    public Guid? CurrentTicketId { get; set; }
}

/// <summary>Occupancy status of a bay.</summary>
public enum BayStatus
{
    Free = 0,
    Occupied = 1,
}

/// <summary>An entry/exit ticket for one vehicle stay.</summary>
public class Ticket
{
    public Guid Id { get; set; }
    public string Plate { get; set; } = string.Empty;
    public VehicleType VehicleType { get; set; }
    public Guid BayId { get; set; }
    public Bay? Bay { get; set; }
    public DateTime EntryAt { get; set; }
    public DateTime? ExitAt { get; set; }
    public TicketStatus Status { get; set; }
    public string? PermitCode { get; set; }
    /// <summary>Set when the attendant reported the physical ticket lost.</summary>
    public DateTime? ReportedLostAt { get; set; }
}

/// <summary>A settled payment for one ticket.</summary>
public class Payment
{
    public Guid Id { get; set; }
    public Guid TicketId { get; set; }
    public Ticket? Ticket { get; set; }
    public decimal Amount { get; set; }
    public PaymentMethod Method { get; set; }
    public DateTime PaidAt { get; set; }
    public bool EvChargingUsed { get; set; }
    public DateTime? RefundedAt { get; set; }
    /// <summary>True when the stay was fully covered by an active permit (no charge).</summary>
    public bool PermitExempt { get; set; }
}

/// <summary>A parking permit granting fee-free stays while valid.</summary>
public class Permit
{
    public string Code { get; set; } = string.Empty;
    public string Plate { get; set; } = string.Empty;
    public DateTime ValidFrom { get; set; }
    public DateTime ValidUntil { get; set; }
}
