namespace Huffcode;

/// S1: frequencies, deterministic Huffman construction, bit codec. Pure BCL only.
public static class Codec
{
    public static Dictionary<byte, int> ByteFrequencies(byte[] data) => new();

    public static Dictionary<byte, string> BuildCodeTable(Dictionary<byte, int> freqs) => new();

    public static string EncodeBits(byte[] data, Dictionary<byte, string> table) => string.Empty;

    public static byte[] DecodeBits(string bits, Dictionary<byte, string> table) => Array.Empty<byte>();
}
