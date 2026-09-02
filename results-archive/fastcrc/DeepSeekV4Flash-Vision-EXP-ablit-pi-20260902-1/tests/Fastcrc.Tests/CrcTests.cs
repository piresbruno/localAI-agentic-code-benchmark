using System.Text;
using Fastcrc;

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
        Assert.Equal(0x00000000u, Crc.Crc32(System.Array.Empty<byte>()));
    }

    [Fact]
    public void handles_binary_and_long_input()
    {
        Assert.Equal(0x81DDA740u, Crc.Crc32(new byte[] { 0x00, 0xFF, 0x80 }));

        byte[] pattern = new byte[1024 * 1024];
        for (int i = 0; i < pattern.Length; i += 2)
        {
            pattern[i] = 0xAB;
            pattern[i + 1] = 0xCD;
        }
        Assert.Equal(0x6941C213u, Crc.Crc32(pattern));
        Assert.Equal(0x6941C213u, Crc.Crc32((byte[])pattern.Clone()));
    }
}
