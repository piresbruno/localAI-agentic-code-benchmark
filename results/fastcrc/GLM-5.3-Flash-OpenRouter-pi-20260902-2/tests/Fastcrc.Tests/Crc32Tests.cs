using Fastcrc;
using Xunit;

namespace Fastcrc.Tests;

/// <summary>R1–R3: pure CRC-32 core semantics (spec §4.1, §5).</summary>
public class Crc32Tests
{
    [Fact]
    public void computes_pinned_crc32_check_values()
    {
        Assert.Equal(0xCBF43926u, Crc.Crc32("123456789"u8.ToArray()));
        Assert.Equal(0x352441C2u, Crc.Crc32("abc"u8.ToArray()));
    }

    [Fact]
    public void empty_input_has_zero_crc()
        => Assert.Equal(0x00000000u, Crc.Crc32(Array.Empty<byte>()));

    [Fact]
    public void handles_binary_and_long_input()
    {
        Assert.Equal(0x81DDA740u, Crc.Crc32(new byte[] { 0x00, 0xFF, 0x80 }));

        var pattern = new byte[1_048_576];
        for (var i = 0; i < pattern.Length; i++)
            pattern[i] = (byte)("123456789"[i % 9]);
        var first = Crc.Crc32(pattern);
        Assert.Equal(0x3AA61225u, first);
        Assert.Equal(first, Crc.Crc32(pattern));
    }
}
