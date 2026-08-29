using Microsoft.Extensions.Options;

namespace ParkWise.Services.Options;

/// <summary>Garage layout: levels 1..3, bay counts per level (config-driven).</summary>
public class GarageOptions
{
    public const string SectionName = "Garage";

    public int Levels { get; set; } = 3;

    /// <summary>Bay counts. Each entry: Level, Type (motorcycle|compact|standard|ev), Count.</summary>
    public List<BaySpec> Bays { get; set; } = new()
    {
        new BaySpec { Level = 1, Type = "motorcycle", Count = 4 },
        new BaySpec { Level = 1, Type = "compact", Count = 10 },
        new BaySpec { Level = 1, Type = "standard", Count = 20 },
        new BaySpec { Level = 2, Type = "compact", Count = 10 },
        new BaySpec { Level = 2, Type = "standard", Count = 25 },
        new BaySpec { Level = 2, Type = "ev", Count = 6 },
        new BaySpec { Level = 3, Type = "standard", Count = 30 },
        new BaySpec { Level = 3, Type = "ev", Count = 5 },
    };
}

/// <summary>One line of the bay layout configuration.</summary>
public class BaySpec
{
    public int Level { get; set; }
    public string Type { get; set; } = "standard";
    public int Count { get; set; }
}
