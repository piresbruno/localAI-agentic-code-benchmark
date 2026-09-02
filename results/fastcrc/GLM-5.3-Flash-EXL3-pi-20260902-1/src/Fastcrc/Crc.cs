namespace Fastcrc;

/// <summary>
/// CRC-32 (IEEE 802.3 / ISO-HDLC), reflected algorithm: poly 0xEDB88320,
/// init 0xFFFFFFFF, xorout 0xFFFFFFFF. Pure: no I/O of any kind.
/// </summary>
public static class Crc
{
    private static readonly uint[] Table = BuildTable();

    /// <summary>Computes the CRC-32 checksum of <paramref name="data"/>; empty input yields 0x00000000.</summary>
    public static uint Crc32(byte[] data)
    {
        uint crc = 0xFFFFFFFF;
        foreach (byte b in data)
            crc = Table[(crc ^ b) & 0xFF] ^ (crc >> 8);
        return crc ^ 0xFFFFFFFF;
    }

    private static uint[] BuildTable()
    {
        var table = new uint[256];
        for (uint i = 0; i < 256; i++)
        {
            uint c = i;
            for (int bit = 0; bit < 8; bit++)
                c = (c & 1) != 0 ? 0xEDB88320 ^ (c >> 1) : c >> 1;
            table[i] = c;
        }
        return table;
    }
}
