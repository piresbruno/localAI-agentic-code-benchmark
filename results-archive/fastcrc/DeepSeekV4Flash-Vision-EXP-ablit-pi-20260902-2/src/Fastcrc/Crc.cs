namespace Fastcrc;

/// <summary>Pure CRC-32 (IEEE 802.3 / ISO-HDLC) implementation.</summary>
public static class Crc
{
    private const uint Polynomial = 0xEDB88320;

    /// <summary>Computes the reflected CRC-32 checksum of <paramref name="data"/> (0 for empty input).</summary>
    public static uint Crc32(byte[] data)
    {
        uint crc = 0xFFFFFFFF;
        foreach (byte b in data)
        {
            crc ^= b;
            for (int bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ Polynomial : crc >> 1;
            }
        }
        return crc ^ 0xFFFFFFFF;
    }
}
