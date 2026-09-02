using Fastcrc;

namespace Fastcrc.Tests;

/// <summary>R1–R3: CRC-32 algorithm rules, exercised by direct calls.</summary>
public class CrcTests
{
    [Fact]
    public void computes_pinned_crc32_check_values()
    {
        Assert.Equal(0xCBF43926u, Crc.Crc32("123456789"u8.ToArray()));
        Assert.Equal(0x352441C2u, Crc.Crc32("abc"u8.ToArray()));
    }

    [Fact]
    public void empty_input_has_zero_crc()
    {
        Assert.Equal(0x00000000u, Crc.Crc32(Array.Empty<byte>()));
    }

    [Fact]
    public void handles_binary_and_long_input()
    {
        byte[] binary = [0x00, 0xFF, 0x80];
        Assert.Equal(0x81DDA740u, Crc.Crc32(binary));

        byte[] pattern = new byte[1 << 20]; // 1 MiB repeating pattern: bytes 0..255, 4096 times
        for (int i = 0; i < pattern.Length; i++)
            pattern[i] = (byte)(i % 256);
        Assert.Equal(0x04D0E435u, Crc.Crc32(pattern));
    }
}
