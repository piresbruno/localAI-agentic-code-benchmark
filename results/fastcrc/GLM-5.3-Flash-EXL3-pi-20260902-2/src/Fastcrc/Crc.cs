using System;

namespace Fastcrc;

/// <summary>
/// CRC-32 (IEEE 802.3 / ISO-HDLC), reflected: polynomial 0xEDB88320,
/// init 0xFFFFFFFF, xorout 0xFFFFFFFF. Pure: no I/O, no environment access.
/// </summary>
public static class Crc
{
    private static readonly uint[] Table = BuildTable(0xEDB88320);

    /// <summary>Computes the CRC-32 checksum of <paramref name="data"/>; empty input yields 0x00000000.</summary>
    public static uint Crc32(byte[] data)
    {
        uint crc = 0xFFFFFFFF;
        foreach (byte b in data)
        {
            crc ^= b;
            crc = (crc >> 8) ^ Table[crc & 0xFF];
        }
        return crc ^ 0xFFFFFFFF;
    }

    private static uint[] BuildTable(uint polynomial)
    {
        var table = new uint[256];
        for (uint i = 0; i < 256; i++)
        {
            uint value = i;
            for (int bit = 0; bit < 8; bit++)
            {
                value = (value & 1) != 0 ? (value >> 1) ^ polynomial : value >> 1;
            }
            table[i] = value;
        }
        return table;
    }
}
