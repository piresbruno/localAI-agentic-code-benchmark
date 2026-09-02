namespace Fastcrc;

/// <summary>CRC-32 (IEEE 802.3 / ISO-HDLC). Pure: no I/O, no Console, no Environment.</summary>
public static class Crc
{
    private static readonly uint[] Table = BuildTable();

    /// <summary>Computes the reflected CRC-32 checksum of <paramref name="data"/>.</summary>
    public static uint Crc32(byte[] data)
    {
        uint crc = 0xFFFFFFFFu;
        foreach (byte value in data)
            crc = Table[(crc ^ value) & 0xFF] ^ (crc >> 8);
        return crc ^ 0xFFFFFFFFu;
    }

    private static uint[] BuildTable()
    {
        uint[] table = new uint[256];
        for (uint index = 0; index < 256; index++)
        {
            uint value = index;
            for (int bit = 0; bit < 8; bit++)
                value = (value & 1) != 0 ? 0xEDB88320u ^ (value >> 1) : value >> 1;
            table[index] = value;
        }
        return table;
    }
}
