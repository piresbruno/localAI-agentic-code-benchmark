using Microsoft.Extensions.Options;

namespace ParkWise.Services.Options;

/// <summary>Garage layout: levels 1..3, bay counts per level (config-driven).</summary>
public class GarageOptions
{
    public const string SectionName = "Garage";

    public int Levels { get; set; } = 3;

    /// <summary>
    /// Bay counts. Each entry: Level, Type (motorcycle|compact|standard|ev), Count.
    /// Deliberately initialized EMPTY: ConfigurationBinder appends to existing collections,
    /// so defaults here would double every configured bay. The default layout lives in
    /// appsettings.json.
    /// </summary>
    public List<BaySpec> Bays { get; set; } = new();
}

/// <summary>One line of the bay layout configuration.</summary>
public class BaySpec
{
    public int Level { get; set; }
    public string Type { get; set; } = "standard";
    public int Count { get; set; }
}
