namespace ParkWise.Services.Abstractions;

/// <summary>Time abstraction. All domain time flows through this; <see cref="DateTime.UtcNow"/>
/// may appear only in <see cref="SystemClock"/> and Program.cs wiring.</summary>
public interface IClock
{
    DateTime UtcNow { get; }
}

/// <summary>Production clock implementation.</summary>
public sealed class SystemClock : IClock
{
    public DateTime UtcNow => DateTime.UtcNow;
}
