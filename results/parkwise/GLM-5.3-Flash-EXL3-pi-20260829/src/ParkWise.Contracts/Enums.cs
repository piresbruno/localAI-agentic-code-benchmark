namespace ParkWise.Contracts;

/// <summary>Vehicle kinds the garage can host.</summary>
public enum VehicleType
{
    Motorcycle = 0,
    Compact = 1,
    Standard = 2,
    Ev = 3,
}

/// <summary>Bay categories. A vehicle occupies its own type or a larger one.</summary>
public enum BayType
{
    Motorcycle = 0,
    Compact = 1,
    Standard = 2,
    Ev = 3,
}

/// <summary>Lifecycle of a ticket.</summary>
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
