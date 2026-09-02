using System;

/// <summary>
/// CRC-32 (IEEE 802.3 / ISO-HDLC), reflected: polynomial 0xEDB88320,
/// init 0xFFFFFFFF, xorout 0xFFFFFFFF. Pure: no I/O, no environment access.
/// </summary>
public static class Crc
{
    /// <summary>Computes the CRC-32 checksum of <paramref name="data"/>; empty input yields 0x00000000.</summary>
    public static uint Crc32(byte[] data) => throw new NotSupportedException("not implemented");
}
