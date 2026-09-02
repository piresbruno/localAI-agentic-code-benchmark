using System.Text;
using Fastcrc;
using Xunit;

namespace Fastcrc.Tests;

public class Crc32Tests
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
        Assert.Equal(0x00000000u, Crc.Crc32([]));
    }

    [Fact]
    public void handles_binary_and_long_input()
    {
        byte[] binary = [0x00, 0xFF, 0x80];
        Assert.Equal(0x81DDA740u, Crc.Crc32(binary));

        byte[] pattern = new byte[1_048_576];
        for (int i = 0; i < pattern.Length; i++)
        {
            pattern[i] = binary[i % binary.Length];
        }
        Assert.Equal(1_048_576, pattern.Length);
        Assert.Equal(0xE4737871u, Crc.Crc32(pattern));
    }
}
