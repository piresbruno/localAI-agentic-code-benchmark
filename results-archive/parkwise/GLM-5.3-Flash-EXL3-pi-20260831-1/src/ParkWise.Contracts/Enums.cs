namespace ParkWise.Contracts;

/// <summary>Vehicle and bay types; one flat bay pool per type.</summary>
public enum VehicleType
{
    Motorcycle = 0,
    Compact = 1,
    Standard = 2,
    Ev = 3,
}

/// <summary>Lifecycle of a ticket: in garage (open), settled (paid), gone (exited), or ticket misplaced (lost).</summary>
public enum TicketStatus
{
    Open = 0,
    Paid = 1,
    Exited = 2,
    Lost = 3,
}

/// <summary>Accepted payment methods.</summary>
public enum PaymentMethod
{
    Card = 0,
    Cash = 1,
    App = 2,
}
