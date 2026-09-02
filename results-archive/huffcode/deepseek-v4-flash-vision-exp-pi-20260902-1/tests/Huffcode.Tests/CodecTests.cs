namespace Huffcode.Tests;

using System.Text;
using Xunit;

public class CodecTests
{
    [Fact]
    public void counts_byte_frequencies_exactly()
    {
        byte[] data = { 65, 66, 65, 66, 10, 10 };
        var freqs = Codec.ByteFrequencies(data);
        Assert.Equal(2, freqs[65]);
        Assert.Equal(2, freqs[66]);
        Assert.Equal(2, freqs[10]);
        Assert.Equal(3, freqs.Count);

        // 0-255 edge: byte 0 and byte 255 must be counted distinctly and exactly.
        byte[] probe = { 0, 255, 0, 0, 255 };
        var pf = Codec.ByteFrequencies(probe);
        Assert.Equal(2, pf.Count);
        Assert.Equal(3, pf[0]);
        Assert.Equal(2, pf[255]);
    }

    [Fact]
    public void builds_minimal_prefix_free_code()
    {
        byte[] data = { 65, 65, 66, 66, 67, 67, 10 }; // "AABBCC\n"
        var freqs = Codec.ByteFrequencies(data);
        var table = Codec.BuildCodeTable(freqs);

        // Every symbol with frequency > 0 has a code, and nothing else does.
        Assert.Equal(freqs.Count, table.Count);
        foreach (var kv in freqs)
        {
            Assert.True(table.ContainsKey(kv.Key));
            Assert.False(string.IsNullOrEmpty(table[kv.Key]));
        }

        AssertPrefixFree(table.Values);

        // Total bit cost must equal the Huffman optimum.
        long actual = 0;
        foreach (var kv in freqs)
        {
            actual += (long)kv.Value * table[kv.Key].Length;
        }
        Assert.Equal(HuffmanOptimalCost(freqs), actual);
    }

    [Fact]
    public void tie_breaks_by_frequency_then_symbol()
    {
        // Pinned: the bytes of "AABBCC\n".
        byte[] data = { 65, 65, 66, 66, 67, 67, 10 };
        var freqs = Codec.ByteFrequencies(data);
        var table = Codec.BuildCodeTable(freqs);
        Assert.Equal("00", table[10]);
        Assert.Equal("01", table[65]);
        Assert.Equal("10", table[66]);
        Assert.Equal("11", table[67]);

        // Equal frequencies: merge the two lowest symbols first; the highest
        // symbol becomes the lonely root child with a length-1 code.
        var eq = new Dictionary<byte, int> { { 65, 1 }, { 66, 1 }, { 67, 1 } };
        var eqTable = Codec.BuildCodeTable(eq);
        Assert.Equal("10", eqTable[65]);
        Assert.Equal("11", eqTable[66]);
        Assert.Equal("0", eqTable[67]);

        // Determinism: building twice yields identical codes.
        var again = Codec.BuildCodeTable(eq);
        Assert.Equal(eqTable.Count, again.Count);
        foreach (var kv in eqTable)
        {
            Assert.Equal(kv.Value, again[kv.Key]);
        }

        // Two-symbol alphabet: lowest symbol gets "0", highest gets "1".
        var two = new Dictionary<byte, int> { { 65, 1 }, { 66, 1 } };
        var twoTable = Codec.BuildCodeTable(two);
        Assert.Equal("0", twoTable[65]);
        Assert.Equal("1", twoTable[66]);
    }

    [Fact]
    public void single_symbol_alphabet_uses_empty_code()
    {
        byte[] data = { 65, 65, 65, 65 }; // "AAAA"
        var freqs = Codec.ByteFrequencies(data);
        Assert.Equal(4, freqs[65]);

        var table = Codec.BuildCodeTable(freqs);
        Assert.Single(table);
        Assert.Equal("", table[65]);

        var bits = Codec.EncodeBits(data, table);
        Assert.Equal("", bits);

        // DecodeBits has no payload-length knowledge; an empty bitstream
        // decodes to nothing. Reconstructing the repeated symbol count is the
        // container/CLI layer's responsibility (PayloadLength in Format/Cli).
        Assert.Empty(Codec.DecodeBits(bits, table));
    }

    [Fact]
    public void encodes_msb_first_and_pads_with_zeros()
    {
        byte[] data = { 65, 65, 66, 66, 67, 67, 10 }; // "AABBCC\n"
        var freqs = Codec.ByteFrequencies(data);
        var table = Codec.BuildCodeTable(freqs);
        var bits = Codec.EncodeBits(data, table);
        Assert.Equal("01011010111100", bits);
    }

    [Fact]
    public void round_trips_arbitrary_bytes()
    {
        // Small alphabet (3 distinct bytes).
        byte[] small = { 1, 2, 1, 2, 3, 2 };
        var t1 = Codec.BuildCodeTable(Codec.ByteFrequencies(small));
        byte[] d1 = Codec.DecodeBits(Codec.EncodeBits(small, t1), t1);
        Assert.Equal(small, d1);

        // 256-symbol alphabet: every byte 0..255 exactly once.
        var all = new byte[256];
        for (int i = 0; i < 256; i++)
        {
            all[i] = (byte)i;
        }
        var t2 = Codec.BuildCodeTable(Codec.ByteFrequencies(all));
        Assert.Equal(256, t2.Count);
        foreach (var kv in t2)
        {
            Assert.Equal(8, kv.Value.Length); // equal counts -> balanced tree
        }
        AssertPrefixFree(t2.Values);

        byte[] d2 = Codec.DecodeBits(Codec.EncodeBits(all, t2), t2);
        Assert.Equal(all, d2);
    }

    [Fact]
    public void round_trips_empty_message()
    {
        var freqs = Codec.ByteFrequencies(Array.Empty<byte>());
        Assert.Empty(freqs);

        var table = Codec.BuildCodeTable(freqs);
        Assert.Empty(table);

        var bits = Codec.EncodeBits(Array.Empty<byte>(), table);
        Assert.Equal("", bits);

        Assert.Empty(Codec.DecodeBits("", table));
    }

    [Fact]
    public void decodes_unknown_prefix_rejects()
    {
        var table = new Dictionary<byte, string> { { 65, "110" } };

        var ex = Assert.Throws<InvalidOperationException>(() => Codec.DecodeBits("111", table));
        Assert.Equal("unknown code prefix", ex.Message);

        // A complete code still decodes.
        Assert.Equal(new byte[] { 65 }, Codec.DecodeBits("110", table));
    }

    private static void AssertPrefixFree(IEnumerable<string> codes)
    {
        var list = codes.ToList();
        for (int i = 0; i < list.Count; i++)
        {
            for (int j = 0; j < list.Count; j++)
            {
                if (i == j)
                {
                    continue;
                }
                string a = list[i];
                string b = list[j];
                if (b.Length >= a.Length && b.StartsWith(a, StringComparison.Ordinal))
                {
                    Assert.Fail($"code \"{a}\" is a prefix of \"{b}\"");
                }
            }
        }
    }

    private static long HuffmanOptimalCost(Dictionary<byte, int> freqs)
    {
        var pq = new PriorityQueue<long, long>();
        foreach (var kv in freqs)
        {
            if (kv.Value > 0)
            {
                pq.Enqueue(kv.Value, kv.Value);
            }
        }

        long total = 0;
        while (pq.Count > 1)
        {
            long a = pq.Dequeue();
            long b = pq.Dequeue();
            long s = a + b;
            total += s;
            pq.Enqueue(s, s);
        }
        return total;
    }
}
