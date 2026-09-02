using System;
using System.IO;
using System.Text;
using Xunit;

namespace Fastcrc.Tests;

public sealed class FastcrcTests
{
    private static byte[] Ascii(string s) => Encoding.ASCII.GetBytes(s);

    private static string FindFixture()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null)
        {
            var candidate = Path.Combine(dir.FullName, "sample", "check.txt");
            if (File.Exists(candidate))
                return candidate;
            dir = dir.Parent;
        }
        throw new InvalidOperationException("sample/check.txt fixture not found");
    }

    private static (int exitCode, string stdout, string stderr) Run(string[] args)
    {
        using var outW = new StringWriter();
        using var errW = new StringWriter();
        var prevOut = Console.Out;
        var prevErr = Console.Error;
        try
        {
            Console.SetOut(outW);
            Console.SetError(errW);
            int code = Cli.RunCli(args);
            return (code, outW.ToString(), errW.ToString());
        }
        finally
        {
            Console.SetOut(prevOut);
            Console.SetError(prevErr);
        }
    }

    [Fact]
    public void computes_pinned_crc32_check_values()
    {
        Assert.Equal(0xCBF43926u, Crc.Crc32(Ascii("123456789")));
        Assert.Equal(0x352441C2u, Crc.Crc32(Ascii("abc")));
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

        var pattern = new byte[1024 * 1024];
        for (int i = 0; i < pattern.Length; i++)
            pattern[i] = (byte)(i % 256);

        Assert.Equal(0x04D0E435u, Crc.Crc32(pattern));
        Assert.Equal(Crc.Crc32(pattern), Crc.Crc32(pattern));
    }

    [Fact]
    public void outputs_lowercase_hex_only()
    {
        var (code, stdout, stderr) = Run(new[] { "--in", FindFixture() });
        Assert.Equal(0, code);
        Assert.Equal("cbf43926\n", stdout);
        Assert.Equal("", stderr);
        Assert.Matches("^[0-9a-f]{8}\\n$", stdout);
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        var (code, stdout, stderr) = Run(new[] { "--in", "does/not/exist.bin" });
        Assert.Equal(1, code);
        Assert.Equal("", stdout);
        Assert.Contains("\"code\":\"INPUT_NOT_FOUND\"", stderr);
        Assert.StartsWith("{\"error\":{\"code\":\"INPUT_NOT_FOUND\"", stderr);
    }

    [Fact]
    public void exit_codes_usage_vs_data()
    {
        Assert.Equal(2, Run(new string[0]).exitCode);
        Assert.Equal(2, Run(new[] { "--foo" }).exitCode);
        Assert.Equal(2, Run(new[] { "--in" }).exitCode);
        Assert.Equal(2, Run(new[] { "--in", "x", "y" }).exitCode);
        Assert.Equal(1, Run(new[] { "--in", "does/not/exist.bin" }).exitCode);
        Assert.Equal(0, Run(new[] { "--in", FindFixture() }).exitCode);
        Assert.Contains("\"code\":\"USAGE\"", Run(new string[0]).stderr);
        Assert.Contains("\"code\":\"INPUT_NOT_FOUND\"", Run(new[] { "--in", "does/not/exist.bin" }).stderr);
    }

    [Fact]
    public void help_and_version_complete()
    {
        var help = Run(new[] { "--help" });
        Assert.Equal(0, help.exitCode);
        Assert.Equal("", help.stderr);
        Assert.Contains("fastcrc --in <file>", help.stdout);
        Assert.Contains("--help", help.stdout);
        Assert.Contains("--version", help.stdout);
        Assert.Contains("Exit codes:", help.stdout);
        Assert.Contains("poly 0xEDB88320", help.stdout);
        Assert.Contains("init 0xFFFFFFFF", help.stdout);
        Assert.Contains("xorout 0xFFFFFFFF", help.stdout);
        Assert.Contains("USAGE", help.stdout);
        Assert.Contains("INPUT_NOT_FOUND", help.stdout);
        Assert.Contains("{\"error\":{\"code\":\"USAGE\",\"message\":\"...\"}}", help.stdout);
        Assert.Contains("cbf43926", help.stdout);

        var version = Run(new[] { "--version" });
        Assert.Equal(0, version.exitCode);
        Assert.Equal("fastcrc 1.0.0\n", version.stdout);
        Assert.Equal("", version.stderr);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var a = Run(new[] { "--in", FindFixture() });
        var b = Run(new[] { "--in", FindFixture() });
        Assert.Equal(a.stdout, b.stdout);
        Assert.Equal(a.stderr, b.stderr);
        Assert.Equal(a.exitCode, b.exitCode);
        Assert.Equal("cbf43926\n", a.stdout);
    }

    [Fact]
    public void cli_prints_pinned_fixture_checksum()
    {
        var (code, stdout, stderr) = Run(new[] { "--in", FindFixture() });
        Assert.Equal(0, code);
        Assert.Equal("cbf43926\n", stdout);
        Assert.Equal("", stderr);
    }
}
