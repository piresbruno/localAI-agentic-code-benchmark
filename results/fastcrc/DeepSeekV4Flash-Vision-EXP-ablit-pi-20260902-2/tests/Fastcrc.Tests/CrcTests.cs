using System.Text;
using Fastcrc;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Fastcrc.Tests;

public sealed class CrcTests
{
    [Fact]
    public void computes_pinned_crc32_check_values()
    {
        Assert.Equal(0xCBF43926u, Crc.Crc32(Encoding.UTF8.GetBytes("123456789")));
        Assert.Equal(0x352441C2u, Crc.Crc32(Encoding.UTF8.GetBytes("abc")));
        Assert.Equal(0x3610A686u, Crc.Crc32(Encoding.UTF8.GetBytes("hello")));
    }

    [Fact]
    public void empty_input_has_zero_crc()
    {
        Assert.Equal(0u, Crc.Crc32(Array.Empty<byte>()));
    }

    [Fact]
    public void handles_binary_and_long_input()
    {
        Assert.Equal(0x81DDA740u, Crc.Crc32(new byte[] { 0x00, 0xFF, 0x80 }));

        var big = new byte[1 << 20];
        for (int i = 0; i < big.Length; i++) big[i] = (byte)((i * 31) & 0xFF);
        var first = Crc.Crc32(big);
        var second = Crc.Crc32(big);
        Assert.Equal(first, second); // deterministic, no overflow corruption
        var copy = new byte[big.Length];
        Array.Copy(big, copy, big.Length);
        Assert.Equal(first, Crc.Crc32(copy)); // same content through another buffer
    }
}
