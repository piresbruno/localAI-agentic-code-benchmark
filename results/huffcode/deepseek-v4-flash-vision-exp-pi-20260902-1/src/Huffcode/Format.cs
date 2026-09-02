namespace Huffcode;

/// S2: .huf container serialize/parse. Pure BCL only.
public static class Format
{
    public static string SerializeHeader(ContainerHeader header) => string.Empty;

    public static ContainerHeader? ParseHeader(string line) => null;

    public static string RenderContainer(Container container) => string.Empty;

    public static Container? ParseContainer(string text) => null;
}
