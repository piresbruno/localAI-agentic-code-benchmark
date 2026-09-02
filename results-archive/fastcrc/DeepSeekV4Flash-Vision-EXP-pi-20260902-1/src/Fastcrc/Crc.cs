namespace Fastcrc;

/// <summary>Pure CRC-32 (IEEE 802.3 / ISO-HDLC) computation.</summary>
public static class Crc
{
    /// <summary>Compute the reflected CRC-32 of an array of bytes.</summary>
    public static uint Crc32(byte[] data)
    {
        uint crc = 0xFFFFFFFF;
        foreach (byte b in data)
        {
            crc ^= b;
            for (int i = 0; i < 8; i++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320 : crc >> 1;
            }
        }
        return crc ^ 0xFFFFFFFF;
    }
}
