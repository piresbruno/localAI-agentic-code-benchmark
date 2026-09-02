using System;
using System.Text;
using Fastcrc;
using Xunit;

namespace Fastcrc.Tests;

public class CrcTests
{
    [Fact]
    public void computes_pinned_crc32_check_values()
    {
        Assert.Equal(0xCBF43926u, Crc.Crc32(Encoding.ASCII.GetBytes("123456789")));
        Assert.Equal(0x352441C2u, Crc.Crc32(Encoding.ASCII.GetBytes("abc")));
    }

    [Fact]
    public void empty_input_has_zero_crc()
    {
        Assert.Equal(0x00000000u, Crc.Crc32(Array.Empty<byte>()));
    }

    [Fact]
    public void handles_binary_and_long_input()
    {
        byte[] binary = { 0x00, 0xFF, 0x80 };
        Assert.Equal(0x81DDA740u, Crc.Crc32(binary));

        var pattern = new byte[256];
        for (int i = 0; i < 256; i++)
        {
            pattern[i] = (byte)i;
        }
        byte[] oneMib = new byte[1024 * 1024];
        for (int offset = 0; offset < oneMib.Length; offset += pattern.Length)
        {
            Array.Copy(pattern, 0, oneMib, offset, pattern.Length);
        }
        Assert.Equal(0x04D0E435u, Crc.Crc32(oneMib));
        Assert.Equal(Crc.Crc32(oneMib), Crc.Crc32((byte[])oneMib.Clone()));
    }
}
