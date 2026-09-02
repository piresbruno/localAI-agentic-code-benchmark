using System.Text;
using Huffcode;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Huffcode.Tests;

public sealed class CliTests
{
    private const string GoldenHeader =
        "{\"version\":1,\"symbols\":[{\"symbol\":10,\"bits\":\"00\"},{\"symbol\":65,\"bits\":\"01\"},{\"symbol\":66,\"bits\":\"10\"},{\"symbol\":67,\"bits\":\"11\"}],\"payloadLength\":7,\"dataBits\":14,\"pad\":2}";
    private const string GoldenContainer = GoldenHeader + "\n5af0";

    private static readonly byte[] SampleBytes = { 0x41, 0x41, 0x42, 0x42, 0x43, 0x43, 0x0A };

    private static string TempDir()
    {
        var dir = Path.Combine(Path.GetTempPath(), "huffcode-" + Guid.NewGuid().ToString("N"));
        Directory.CreateDirectory(dir);
        return dir;
    }

    private static (string StdOut, string StdErr, int Code) RunCli(params string[] args)
    {
        var so = new StringWriter();
        var se = new StringWriter();
        var prevOut = Console.Out;
        var prevErr = Console.Error;
        int code;
        try
        {
            Console.SetOut(so);
            Console.SetError(se);
            code = Cli.RunCli(args);
        }
        finally
        {
            Console.SetOut(prevOut);
            Console.SetError(prevErr);
        }
        return (so.ToString(), se.ToString(), code);
    }

    [Fact]
    public void produces_pinned_golden_bytes()
    {
        var dir = TempDir();
        try
        {
            var inp = Path.Combine(dir, "in.txt");
            var outPath = Path.Combine(dir, "out.huf");
            File.WriteAllBytes(inp, SampleBytes);

            var (stdout, stderr, code) = RunCli("encode", "--in", inp, "--out", outPath);
            Assert.Equal(0, code);
            Assert.Equal("", stdout);
            Assert.Equal("", stderr);
            Assert.Equal(GoldenContainer, Encoding.UTF8.GetString(File.ReadAllBytes(outPath)));

            var decoded = Path.Combine(dir, "decoded.txt");
            var (o2, e2, c2) = RunCli("decode", "--in", outPath, "--out", decoded);
            Assert.Equal(0, c2);
            Assert.Equal("", o2);
            Assert.Equal("", e2);
            Assert.Equal(SampleBytes, File.ReadAllBytes(decoded));
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void round_trips_empty_message()
    {
        var dir = TempDir();
        try
        {
            var inp = Path.Combine(dir, "empty.bin");
            var outPath = Path.Combine(dir, "out.huf");
            File.WriteAllBytes(inp, Array.Empty<byte>());

            var (_, _, code) = RunCli("encode", "--in", inp, "--out", outPath);
            Assert.Equal(0, code);
            var text = Encoding.UTF8.GetString(File.ReadAllBytes(outPath));
            Assert.Equal(
                "{\"version\":1,\"symbols\":[],\"payloadLength\":0,\"dataBits\":0,\"pad\":0}\n",
                text);

            var decoded = Path.Combine(dir, "dec.bin");
            var (_, _, code2) = RunCli("decode", "--in", outPath, "--out", decoded);
            Assert.Equal(0, code2);
            Assert.Empty(File.ReadAllBytes(decoded));
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var dir = TempDir();
        try
        {
            var inp = Path.Combine(dir, "in.txt");
            var out1 = Path.Combine(dir, "out1.huf");
            var out2 = Path.Combine(dir, "out2.huf");
            File.WriteAllBytes(inp, SampleBytes);

            Assert.Equal(0, RunCli("encode", "--in", inp, "--out", out1).Code);
            Assert.Equal(0, RunCli("encode", "--in", inp, "--out", out2).Code);
            Assert.Equal(File.ReadAllBytes(out1), File.ReadAllBytes(out2));
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void exit_codes_data_vs_usage()
    {
        var dir = TempDir();
        try
        {
            var inp = Path.Combine(dir, "in.txt");
            var outPath = Path.Combine(dir, "out.huf");
            File.WriteAllBytes(inp, SampleBytes);

            var empty = RunCli();
            Assert.Equal(2, empty.Code);
            Assert.Equal("{\"error\":{\"code\":\"USAGE\",\"message\":\"missing command\"}}\n", empty.StdErr);
            Assert.Equal("", empty.StdOut);

            var unknownCmd = RunCli("bogus");
            Assert.Equal(2, unknownCmd.Code);
            Assert.Equal("{\"error\":{\"code\":\"USAGE\",\"message\":\"unknown command: bogus\"}}\n", unknownCmd.StdErr);

            var noIn = RunCli("encode", "--out", outPath);
            Assert.Equal(2, noIn.Code);
            Assert.Equal("{\"error\":{\"code\":\"USAGE\",\"message\":\"missing --in\"}}\n", noIn.StdErr);

            var noOut = RunCli("decode", "--in", inp);
            Assert.Equal(2, noOut.Code);
            Assert.Equal("{\"error\":{\"code\":\"USAGE\",\"message\":\"missing --out\"}}\n", noOut.StdErr);

            var unknownFlag = RunCli("encode", "--in", inp, "--foo", "x");
            Assert.Equal(2, unknownFlag.Code);
            Assert.Equal("{\"error\":{\"code\":\"USAGE\",\"message\":\"unknown flag: --foo\"}}\n", unknownFlag.StdErr);

            var noValue = RunCli("encode", "--in");
            Assert.Equal(2, noValue.Code);
            Assert.Equal("{\"error\":{\"code\":\"USAGE\",\"message\":\"missing value for --in\"}}\n", noValue.StdErr);

            var missingInput = RunCli("decode", "--in", Path.Combine(dir, "nope.huf"), "--out", outPath);
            Assert.Equal(1, missingInput.Code);
            Assert.Equal(
                "{\"error\":{\"code\":\"INPUT_NOT_FOUND\",\"message\":\"input not found: " + Path.Combine(dir, "nope.huf") + "\"}}\n",
                missingInput.StdErr);
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void rejects_invalid_headers()
    {
        var dir = TempDir();
        try
        {
            var outPath = Path.Combine(dir, "o.huf");
            var decoded = Path.Combine(dir, "d.bin");

            // garbage
            var garbage = Path.Combine(dir, "g.huf");
            File.WriteAllText(garbage, "not json\n");
            var (_, _, c1) = RunCli("decode", "--in", garbage, "--out", decoded);
            Assert.Equal(1, c1);

            // wrong version
            var wrongVersion = Path.Combine(dir, "v.huf");
            File.WriteAllText(wrongVersion, "{\"version\":2,\"symbols\":[],\"payloadLength\":0,\"dataBits\":0,\"pad\":0}\n");
            var (_, _, c2) = RunCli("decode", "--in", wrongVersion, "--out", decoded);
            Assert.Equal(1, c2);

            // non-prefix-free table
            var nonPrefix = Path.Combine(dir, "np.huf");
            File.WriteAllText(nonPrefix,
                "{\"version\":1,\"symbols\":[{\"symbol\":65,\"bits\":\"0\"},{\"symbol\":66,\"bits\":\"01\"}],\"payloadLength\":1,\"dataBits\":1,\"pad\":7}\n40");
            var (_, _, c3) = RunCli("decode", "--in", nonPrefix, "--out", decoded);
            Assert.Equal(1, c3);

            // payloadLength mismatch
            var mismatch = Path.Combine(dir, "pm.huf");
            File.WriteAllText(mismatch, GoldenContainer.Replace("\"payloadLength\":7", "\"payloadLength\":9"));
            var (_, _, c4) = RunCli("decode", "--in", mismatch, "--out", decoded);
            Assert.Equal(1, c4);

            // bad hex (odd length)
            var badHex = Path.Combine(dir, "bh.huf");
            File.WriteAllText(badHex, GoldenHeader + "\n5af");
            var (_, _, c5) = RunCli("decode", "--in", badHex, "--out", decoded);
            Assert.Equal(1, c5);

            // nonzero pad bits: dataBits 2 -> pad 6, byte 0x41 has low 6 bits nonzero
            var padBits = Path.Combine(dir, "pb.huf");
            File.WriteAllText(padBits,
                "{\"version\":1,\"symbols\":[{\"symbol\":10,\"bits\":\"0\"},{\"symbol\":65,\"bits\":\"1\"}],\"payloadLength\":1,\"dataBits\":2,\"pad\":6}\n41");
            var (_, _, c6) = RunCli("decode", "--in", padBits, "--out", decoded);
            Assert.Equal(1, c6);
        }
        finally
        {
            Directory.Delete(dir, true);
        }
    }

    [Fact]
    public void help_is_complete_and_version_prints()
    {
        var help = RunCli("--help");
        Assert.Equal(0, help.Code);
        Assert.Equal("", help.StdErr);
        foreach (var needle in new[]
                 {
                     "encode", "decode", "--in", "--out", "Exit codes", "envelope",
                     "Container format", "Determinism", "Examples", "USAGE", "INVALID_HEADER",
                     "sample/message.txt", "payloadLength",
                 })
        {
            Assert.Contains(needle, help.StdOut);
        }

        var version = RunCli("--version");
        Assert.Equal(0, version.Code);
        Assert.Equal("huffcode 1.0.0\n", version.StdOut);
    }
}
