namespace Fastcrc;

/// <summary>
/// CRC-32 (IEEE 802.3 / ISO-HDLC) checksum algorithm. Pure: no I/O, no
/// console, no environment access.
/// </summary>
public static class Crc
{
    /// <summary>
    /// Computes the CRC-32 checksum of <paramref name="data"/> using the
    /// reflected polynomial 0xEDB88320, initial value 0xFFFFFFFF and final
    /// xor 0xFFFFFFFF. An empty input yields 0x00000000.
    /// </summary>
    public static uint Crc32(byte[] data)
    {
        uint crc = 0xFFFFFFFF;
        foreach (byte b in data)
        {
            crc ^= b;
            for (int bit = 0; bit < 8; bit++)
            {
                crc = (crc & 1) != 0 ? (crc >> 1) ^ 0xEDB88320 : crc >> 1;
            }
        }
        return crc ^ 0xFFFFFFFF;
    }
}