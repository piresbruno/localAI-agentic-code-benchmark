using System.Text.Json;
using Fastcrc;
using Xunit;

namespace Fastcrc.Tests;

/// <summary>R4–R8: CLI surface via in-process RunCli with captured streams (spec §5, §7).</summary>
public class CliTests
{
    [Fact]
    public void outputs_lowercase_hex_only()
    {
        var r = TestHost.Run("--in", TestHost.SamplePath());
        Assert.Equal(0, r.Exit);
        Assert.Equal("cbf43926\n", r.Stdout);
        Assert.Equal(string.Empty, r.Stderr);
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        var r = TestHost.Run("--in", "no-such-file-here.bin");
        Assert.Equal(1, r.Exit);
        Assert.Equal(string.Empty, r.Stdout);
        var envelope = AssertEnvelope(r.Stderr);
        Assert.Equal("INPUT_NOT_FOUND", envelope.code);
    }

    [Fact]
    public void exit_codes_usage_vs_data()
    {
        foreach (var args in new[]
                 {
                    Array.Empty<string>(),
                    new[] { "--bogus" },
                    new[] { "--in" },
                    new[] { "--in", TestHost.SamplePath(), "extra" },
                 })
        {
            var r = TestHost.Run(args);
            Assert.Equal(2, r.Exit);
            Assert.Equal(string.Empty, r.Stdout);
            var envelope = AssertEnvelope(r.Stderr);
            Assert.Equal("USAGE", envelope.code);
        }

        var ok = TestHost.Run("--in", TestHost.SamplePath());
        Assert.Equal(0, ok.Exit);

        var data = TestHost.Run("--in", "missing-file.bin");
        Assert.Equal(1, data.Exit);
    }

    [Fact]
    public void help_and_version_complete()
    {
        var help = TestHost.Run("--help");
        Assert.Equal(0, help.Exit);
        Assert.Equal(string.Empty, help.Stderr);
        foreach (var needle in new[]
                 {
                    "--in", "EXIT CODES", "0  success", "1  data", "2  usage",
                    "0xEDB88320", "init 0xFFFFFFFF", "xorout 0xFFFFFFFF",
                    "cbf43926", "{\"error\":", "USAGE", "INPUT_NOT_FOUND",
                 })
            Assert.Contains(needle, help.Stdout);

        var shortHelp = TestHost.Run("-h");
        Assert.Equal(help.Stdout, shortHelp.Stdout);

        var version = TestHost.Run("--version");
        Assert.Equal(0, version.Exit);
        Assert.Equal("fastcrc 1.0.0\n", version.Stdout);

        var shortVersion = TestHost.Run("-v");
        Assert.Equal("fastcrc 1.0.0\n", shortVersion.Stdout);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var a = TestHost.Run("--in", TestHost.SamplePath());
        var b = TestHost.Run("--in", TestHost.SamplePath());
        Assert.Equal(a.Stdout, b.Stdout);
        Assert.Equal(a.Exit, b.Exit);
        Assert.Equal(a.Stderr, b.Stderr);
    }

    private static (string code, string message) AssertEnvelope(string stderr)
    {
        var envelope = JsonSerializer.Deserialize<JsonElement>(stderr);
        var err = envelope.GetProperty("error");
        return (err.GetProperty("code").GetString()!, err.GetProperty("message").GetString()!);
    }
}
