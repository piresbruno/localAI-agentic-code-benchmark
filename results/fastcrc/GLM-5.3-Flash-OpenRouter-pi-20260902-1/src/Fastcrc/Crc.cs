namespace Fastcrc;

/// <summary>CRC-32 (IEEE 802.3 / ISO-HDLC), reflected, table-driven. Pure: no I/O, no console.</summary>
public static class Crc
{
    private const uint Poly = 0xEDB88320u;
    private const uint Init = 0xFFFFFFFFu;
    private const uint XorOut = 0xFFFFFFFFu;

    private static readonly uint[] Table = BuildTable();

    /// <summary>Computes the CRC-32 checksum of <paramref name="data"/>.</summary>
    public static uint Crc32(byte[] data)
    {
        uint crc = Init;
        foreach (byte b in data)
        {
            crc = Table[(crc ^ b) & 0xFF] ^ (crc >> 8);
        }
        return crc ^ XorOut;
    }

    private static uint[] BuildTable()
    {
        var table = new uint[256];
        for (uint i = 0; i < 256; i++)
        {
            uint c = i;
            for (int bit = 0; bit < 8; bit++)
            {
                c = (c & 1) != 0 ? Poly ^ (c >> 1) : c >> 1;
            }
            table[i] = c;
        }
        return table;
    }
}
