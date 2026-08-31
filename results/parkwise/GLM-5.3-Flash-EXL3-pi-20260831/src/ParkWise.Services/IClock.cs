namespace ParkWise.Services;

/// <summary>Injectable time source — `DateTime.UtcNow` lives only in the implementation and Program wiring.</summary>
public interface IClock
{
    DateTime UtcNow { get; }
}

/// <summary>System clock used in production wiring.</summary>
public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
