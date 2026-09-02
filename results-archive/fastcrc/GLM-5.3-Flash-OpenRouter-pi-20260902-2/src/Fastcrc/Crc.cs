namespace Fastcrc;

/// <summary>Pure CRC-32 (IEEE 802.3) computation — the only algorithm module.</summary>
public static class Crc
{
    /// <summary>Reflected polynomial 0xEDB88320 of 0x04C11DB7.</summary>
    private const uint Poly = 0xEDB88320u;

    private static readonly uint[] Table = BuildTable();

    private static uint[] BuildTable()
    {
        var table = new uint[256];
        for (uint i = 0; i < 256; i++)
        {
            var crc = i;
            for (var bit = 0; bit < 8; bit++)
                crc = (crc & 1) != 0 ? (crc >> 1) ^ Poly : crc >> 1;
            table[i] = crc;
        }
        return table;
    }

    /// <summary>Computes the CRC-32 checksum of <paramref name="data"/> (init 0xFFFFFFFF, xorout 0xFFFFFFFF).</summary>
    public static uint Crc32(byte[] data)
    {
        var crc = 0xFFFFFFFFu;
        foreach (var b in data)
            crc = (crc >> 8) ^ Table[(crc ^ b) & 0xFF];
        return crc ^ 0xFFFFFFFFu;
    }
}
