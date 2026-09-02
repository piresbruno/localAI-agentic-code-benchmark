using System.Text;
using Fastcrc;
using Xunit;

namespace Fastcrc.Tests;

public sealed class CliTests
{
    private static string TempFile(string content)
    {
        var path = Path.Combine(Path.GetTempPath(), "fastcrc-" + Guid.NewGuid().ToString("N") + ".bin");
        File.WriteAllBytes(path, Encoding.UTF8.GetBytes(content));
        return path;
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
    public void renders_golden_checksum_bytes()
    {
        var file = TempFile("123456789");
        try
        {
            var (stdout, stderr, code) = RunCli("--in", file);
            Assert.Equal(0, code);
            Assert.Equal("cbf43926\n", stdout);
            Assert.Equal("", stderr);
        }
        finally
        {
            File.Delete(file);
        }
    }

    [Fact]
    public void outputs_lowercase_hex_only()
    {
        var file = TempFile("abc");
        try
        {
            var (stdout, _, code) = RunCli("--in", file);
            Assert.Equal(0, code);
            Assert.Equal("352441c2\n", stdout);
        }
        finally
        {
            File.Delete(file);
        }
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        var (stdout, stderr, code) = RunCli("--in", "no/such/file.bin");
        Assert.Equal(1, code);
        Assert.Equal("", stdout);
        Assert.Equal(
            "{\"error\":{\"code\":\"INPUT_NOT_FOUND\",\"message\":\"input not found: no/such/file.bin\"}}\n",
            stderr);
    }

    [Theory]
    [InlineData(new string[0], "missing --in")]
    [InlineData(new[] { "--in" }, "missing value for --in")]
    [InlineData(new[] { "--wat" }, "unknown flag: --wat")]
    [InlineData(new[] { "--in", "x", "extra" }, "unknown argument: extra")]
    public void exit_codes_usage_vs_data(string[] args, string message)
    {
        var (stdout, stderr, code) = RunCli(args);
        Assert.Equal(2, code);
        Assert.Equal("", stdout);
        Assert.Equal($"{{\"error\":{{\"code\":\"USAGE\",\"message\":\"{message}\"}}}}\n", stderr);
    }

    [Fact]
    public void help_and_version_complete()
    {
        var help = RunCli("--help");
        Assert.Equal(0, help.Code);
        Assert.Equal("", help.StdErr);
        foreach (var needle in new[]
                 {
                     "--in", "EXIT CODES", "ERROR FORMAT", "ALGORITHM", "0xEDB88320",
                     "EXAMPLE", "cbf43926", "USAGE", "INPUT_NOT_FOUND",
                 })
        {
            Assert.Contains(needle, help.StdOut);
        }

        var version = RunCli("--version");
        Assert.Equal(0, version.Code);
        Assert.Equal("fastcrc 1.0.0\n", version.StdOut);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var file = TempFile("123456789");
        try
        {
            var first = RunCli("--in", file);
            var second = RunCli("--in", file);
            Assert.Equal(0, first.Code);
            Assert.Equal(second.StdOut, first.StdOut);
            Assert.Equal("cbf43926\n", first.StdOut);
        }
        finally
        {
            File.Delete(file);
        }
    }
}
