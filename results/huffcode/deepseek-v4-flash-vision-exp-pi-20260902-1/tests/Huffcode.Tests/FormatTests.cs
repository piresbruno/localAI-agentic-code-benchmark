using Huffcode;
using Xunit;

namespace Huffcode.Tests;

public sealed class FormatTests
{
    private const string GoldenHeader =
        "{\"version\":1,\"symbols\":[{\"symbol\":10,\"bits\":\"00\"},{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":66,\"bits\":\"10\"},{\"symbol\":67,\"bits\":\"11\"}],\"payloadLength\":7,\"dataBits\":14,\"pad\":2}";
    private const string GoldenHex = "5af0";

    private static ContainerHeader BuildGoldenHeader() => new ContainerHeader(
        Version: 1,
        Symbols: new[]
        {
            new CodeTableEntry(10, "00"),
            new CodeTableEntry(65, "01"),
            new CodeTableEntry(66, "10"),
            new CodeTableEntry(67, "11"),
        },
        PayloadLength: 7,
        DataBits: 14,
        Pad: 2);

    private static string HeaderJson(
        string version = "1",
        string symbols = "[]",
        string payloadLength = "0",
        string dataBits = "0",
        string pad = "0")
        => "{\"version\":" + version
           + ",\"symbols\":" + symbols
           + ",\"payloadLength\":" + payloadLength
           + ",\"dataBits\":" + dataBits
           + ",\"pad\":" + pad + "}";

    private static void AssertHeaderEqual(ContainerHeader expected, ContainerHeader actual)
    {
        Assert.Equal(expected.Version, actual.Version);
        Assert.Equal(expected.PayloadLength, actual.PayloadLength);
        Assert.Equal(expected.DataBits, actual.DataBits);
        Assert.Equal(expected.Pad, actual.Pad);
        Assert.Equal(expected.Symbols.Length, actual.Symbols.Length);
        for (int i = 0; i < expected.Symbols.Length; i++)
        {
            Assert.Equal(expected.Symbols[i], actual.Symbols[i]);
        }
    }

    private static void AssertContainerEqual(Container expected, Container actual)
    {
        AssertHeaderEqual(expected.Header, actual.Header);
        Assert.Equal(expected.DataHex, actual.DataHex);
    }

    [Fact]
    public void round_trips_header_and_container()
    {
        ContainerHeader header = BuildGoldenHeader();
        Container container = new Container(header, GoldenHex);

        string goldenContainer = GoldenHeader + "\n" + GoldenHex;
        Assert.Equal(GoldenHeader, Format.SerializeHeader(header));
        Assert.Equal(goldenContainer, Format.RenderContainer(container));

        ContainerHeader? parsedHeader = Format.ParseHeader(GoldenHeader);
        Assert.NotNull(parsedHeader);
        AssertHeaderEqual(header, parsedHeader);

        Container? parsedContainer = Format.ParseContainer(goldenContainer);
        Assert.NotNull(parsedContainer);
        AssertContainerEqual(container, parsedContainer);
    }

    [Fact]
    public void rejects_invalid_headers()
    {
        string[] invalidHeaders =
        {
            // Not JSON.
            "{",
            // Version != 1.
            HeaderJson(version: "2"),
            // Missing pad.
            "{\"version\":1,\"symbols\":[],\"payloadLength\":0,\"dataBits\":0}",
            // Extra field.
            "{\"version\":1,\"symbols\":[],\"payloadLength\":0,\"dataBits\":0,\"pad\":0,\"x\":1}",
            // Wrong type for pad (string instead of number).
            "{\"version\":1,\"symbols\":[],\"payloadLength\":0,\"dataBits\":0,\"pad\":\"2\"}",
            // Unsorted symbols.
            "{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":10,\"bits\":\"00\"}],\"payloadLength\":0,\"dataBits\":4,\"pad\":4}",
            // Duplicate symbol.
            "{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":65,\"bits\":\"00\"}],\"payloadLength\":0,\"dataBits\":4,\"pad\":4}",
            // Bits contain a non-binary char.
            "{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"02\"}],\"payloadLength\":0,\"dataBits\":2,\"pad\":6}",
            // Non-prefix-free codes {"01","0"}.
            "{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":66,\"bits\":\"0\"}],\"payloadLength\":0,\"dataBits\":3,\"pad\":5}",
            // Empty bits with more than one symbol.
            "{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":66,\"bits\":\"\"}],\"payloadLength\":0,\"dataBits\":2,\"pad\":6}",
            // Pad inconsistent with DataBits 14 (must be 2).
            "{\"version\":1,\"symbols\":[{\"symbol\":10,\"bits\":\"00\"},{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":66,\"bits\":\"10\"},{\"symbol\":67,\"bits\":\"11\"}],\"payloadLength\":7,\"dataBits\":14,\"pad\":3}",
            // Pad 0 inconsistent with DataBits 5 (must be 3).
            "{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"0\"},{\"symbol\":66,\"bits\":\"1\"}],\"payloadLength\":2,\"dataBits\":5,\"pad\":0}",
            // Negative PayloadLength.
            "{\"version\":1,\"symbols\":[],\"payloadLength\":-1,\"dataBits\":0,\"pad\":0}",
        };

        foreach (string bad in invalidHeaders)
        {
            Assert.Null(Format.ParseHeader(bad));
        }

        // Pad 3 IS valid for DataBits 5.
        Assert.NotNull(Format.ParseHeader("{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"0\"},{\"symbol\":66,\"bits\":\"1\"}],\"payloadLength\":2,\"dataBits\":5,\"pad\":3}"));
    }

    [Fact]
    public void rejects_invalid_containers()
    {
        // Odd hex length (expected ceil(14/8)*2 = 4 chars).
        Assert.Null(Format.ParseContainer(GoldenHeader + "\n5af"));
        // Non-hex characters.
        Assert.Null(Format.ParseContainer(GoldenHeader + "\nzz"));
        // Trailing newline / characters after the hex line.
        Assert.Null(Format.ParseContainer(GoldenHeader + "\n" + GoldenHex + "\n"));
        // Empty hex with DataBits 8 (expected 1 byte = 2 hex chars).
        Assert.Null(Format.ParseContainer("{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"01010101\"}],\"payloadLength\":1,\"dataBits\":8,\"pad\":0}\n"));
        // Nonzero pad bits: DataBits 2, Pad 6, byte 0x41 has low 6 bits nonzero.
        Assert.Null(Format.ParseContainer("{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":66,\"bits\":\"00\"}],\"payloadLength\":2,\"dataBits\":2,\"pad\":6}\n41"));
        // Header-only without a newline is invalid.
        Assert.Null(Format.ParseContainer("{\"version\":1,\"symbols\":[],\"payloadLength\":0,\"dataBits\":0,\"pad\":0}"));

        // Counterexample: same DataBits/Pad with zero low bits is valid.
        Assert.NotNull(Format.ParseContainer("{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":66,\"bits\":\"00\"}],\"payloadLength\":2,\"dataBits\":2,\"pad\":6}\n40"));
    }

    [Fact]
    public void rejects_unknown_prefix_free_issue()
    {
        Assert.Null(Format.ParseHeader("{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"0\"},{\"symbol\":66,\"bits\":\"01\"}],\"payloadLength\":0,\"dataBits\":3,\"pad\":5}"));
    }

    [Fact]
    public void round_trips_empty_container()
    {
        const string emptyHeader = "{\"version\":1,\"symbols\":[],\"payloadLength\":0,\"dataBits\":0,\"pad\":0}";
        ContainerHeader header = new ContainerHeader(1, Array.Empty<CodeTableEntry>(), 0, 0, 0);
        Container container = new Container(header, string.Empty);

        Assert.Equal(emptyHeader + "\n", Format.RenderContainer(container));

        Container? parsed = Format.ParseContainer(emptyHeader + "\n");
        Assert.NotNull(parsed);
        AssertContainerEqual(container, parsed);
    }
}
