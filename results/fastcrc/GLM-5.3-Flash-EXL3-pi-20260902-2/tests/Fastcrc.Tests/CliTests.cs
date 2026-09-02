using System;
using System.IO;
using Fastcrc;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Fastcrc.Tests;

public class CliTests
{
    private static (int Exit, string Out, string Err) Run(params string[] args)
    {
        TextWriter originalOut = Console.Out;
        TextWriter originalErr = Console.Error;
        var outWriter = new StringWriter();
        var errWriter = new StringWriter();
        Console.SetOut(outWriter);
        Console.SetError(errWriter);
        try
        {
            int exit = Cli.RunCli(args);
            return (exit, outWriter.ToString(), errWriter.ToString());
        }
        finally
        {
            Console.SetOut(originalOut);
            Console.SetError(originalErr);
        }
    }

    [Fact]
    public void outputs_lowercase_hex_only()
    {
        var (exit, stdout, stderr) = Run("--in", "sample/check.txt");
        Assert.Equal(0, exit);
        Assert.Equal("cbf43926\n", stdout);
        Assert.Equal(string.Empty, stderr);
        Assert.DoesNotContain((char)0x1B, stdout);
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        var (exit, stdout, stderr) = Run("--in", "no/such/input.bin");
        Assert.Equal(1, exit);
        Assert.Equal(string.Empty, stdout);
        Assert.Equal("{\"error\":{\"code\":\"INPUT_NOT_FOUND\",\"message\":\"input file not found: no/such/input.bin\"}}\n", stderr);
    }

    [Fact]
    public void exit_codes_usage_vs_data()
    {
        var (successExit, _, successErr) = Run("--in", "sample/check.txt");
        Assert.Equal(0, successExit);
        Assert.Equal(string.Empty, successErr);

        var (dataExit, _, dataErr) = Run("--in", "missing.bin");
        Assert.Equal(1, dataExit);
        Assert.StartsWith("{\"error\":{\"code\":\"INPUT_NOT_FOUND\",\"message\":\"", dataErr);
        Assert.EndsWith("\"}}\n", dataErr);

        string[][] usageCases =
        {
            Array.Empty<string>(),
            new[] { "--foo" },
            new[] { "-x" },
            new[] { "--in" },
            new[] { "--in", "" },
            new[] { "--in", "sample/check.txt", "extra.txt" },
            new[] { "positional.txt" },
        };
        foreach (string[] args in usageCases)
        {
            var (exit, stdout, stderr) = Run(args);
            Assert.Equal(2, exit);
            Assert.Equal(string.Empty, stdout);
            Assert.StartsWith("{\"error\":{\"code\":\"USAGE\",\"message\":\"", stderr);
            Assert.EndsWith("\"}}\n", stderr);
            Assert.DoesNotContain((char)0x1B, stderr);
        }
    }

    [Fact]
    public void help_and_version_complete()
    {
        var (exit, stdout, stderr) = Run("--help");
        Assert.Equal(0, exit);
        Assert.Equal(string.Empty, stderr);
        Assert.Contains("fastcrc --in <file>", stdout);
        Assert.Contains("--in <file>", stdout);
        Assert.Contains("Required", stdout);
        Assert.Contains("--help | -h", stdout);
        Assert.Contains("--version | -v", stdout);
        Assert.Contains("success", stdout);
        Assert.Contains("data error", stdout);
        Assert.Contains("usage error", stdout);
        Assert.Contains("{\"error\":{\"code\":\"USAGE\",\"message\":\"unknown flag: --foo\"}}", stdout);
        Assert.Contains("IEEE 802.3", stdout);
        Assert.Contains("0xEDB88320", stdout);
        Assert.Contains("init 0xFFFFFFFF", stdout);
        Assert.Contains("xorout 0xFFFFFFFF", stdout);
        Assert.Contains("cbf43926", stdout);

        var (shortExit, shortOut, _) = Run("-h");
        Assert.Equal(0, shortExit);
        Assert.Equal(stdout, shortOut);

        var (versionExit, versionOut, versionErr) = Run("--version");
        Assert.Equal(0, versionExit);
        Assert.Equal("fastcrc 1.0.0\n", versionOut);
        Assert.Equal(string.Empty, versionErr);

        var (shortVersionExit, shortVersionOut, _) = Run("-v");
        Assert.Equal(0, shortVersionExit);
        Assert.Equal(versionOut, shortVersionOut);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var first = Run("--in", "sample/check.txt");
        var second = Run("--in", "sample/check.txt");
        Assert.Equal(0, first.Exit);
        Assert.Equal(0, second.Exit);
        Assert.Equal(first.Out, second.Out);
        Assert.Equal(first.Err, second.Err);
    }
}
