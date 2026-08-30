namespace ParkWise.Services;

/// <summary>Abstraction over time so all business logic is deterministic and testable.</summary>
public interface IClock
{
    /// <summary>Current UTC time.</summary>
    DateTime UtcNow { get; }
}
