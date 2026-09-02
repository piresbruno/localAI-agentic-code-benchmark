using System;
using System.Text;
using Xunit;

namespace Fastcrc.Tests;

/// <summary>R1-R3: algorithm-level tests, direct <c>Crc32</c> calls.</summary>
public class AlgorithmTests
{
    [Fact]
    public void computes_pinned_crc32_check_values()
    {
        // R1: "123456789" -> cbf43926; "abc" -> 352441c2
        Assert.Equal(0xCBF43926u, Crc.Crc32(Encoding.ASCII.GetBytes("123456789")));
        Assert.Equal(0x352441C2u, Crc.Crc32(Encoding.ASCII.GetBytes("abc")));
    }

    [Fact]
    public void empty_input_has_zero_crc()
    {
        // R2: empty input -> 00000000
        Assert.Equal(0x00000000u, Crc.Crc32(Array.Empty<byte>()));
    }

    [Fact]
    public void handles_binary_and_long_input()
    {
        // R3: bytes {0x00,0xFF,0x80} and a 1 MiB repeating pattern are deterministic and correct.
        byte[] binary = { 0x00, 0xFF, 0x80 };
        Assert.Equal(0x81DDA740u, Crc.Crc32(binary));

        byte[] block = new byte[1024];
        for (int i = 0; i < block.Length; i++)
        {
            block[i] = (byte)((i * 7 + 3) % 256);
        }

        byte[] big = new byte[1024 * 1024];
        for (int i = 0; i < big.Length; i++)
        {
            big[i] = block[i % block.Length];
        }

        Assert.Equal(0x4A24D8FAu, Crc.Crc32(big));
    }
}
