namespace Fastcrc;

/// Pure CRC-32/ISO-HDLC (IEEE 802.3). BCL only — no IO, no Console.
public static class Crc
{
    private static readonly uint[] Table = BuildTable();

    private static uint[] BuildTable()
    {
        var table = new uint[256];
        for (uint n = 0; n < 256; n++)
        {
            uint c = n;
            for (int k = 0; k < 8; k++)
            {
                c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1;
            }
            table[n] = c;
        }
        return table;
    }

    public static uint Crc32(byte[] data)
    {
        uint c = 0xFFFFFFFF;
        foreach (byte b in data)
        {
            c = Table[(int)((c ^ b) & 0xFF)] ^ (c >> 8);
        }
        return c ^ 0xFFFFFFFF;
    }
}
