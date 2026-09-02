using System.Text;
using System.Text.Json;
using Fastcrc;
using Xunit;

namespace Fastcrc.Tests;

public class CliTests
{
    private static readonly string RepoRoot = FindRepoRoot();

    private static string FindRepoRoot()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "sample", "check.txt")))
        {
            dir = dir.Parent;
        }
        return dir is null
            ? throw new InvalidOperationException("sample/check.txt not found above test base directory")
            : dir.FullName;
    }

    private static (byte[] Stdout, byte[] Stderr, int Exit) Run(params string[] args)
    {
        var stdout = new MemoryStream();
        var stderr = new MemoryStream();
        TextWriter outWriter = new StreamWriter(stdout) { AutoFlush = true };
        TextWriter errWriter = new StreamWriter(stderr) { AutoFlush = true };
        TextWriter prevOut = Console.Out;
        TextWriter prevErr = Console.Error;
        Console.SetOut(outWriter);
        Console.SetError(errWriter);
        try
        {
            int exit = Cli.RunCli(args);
            return (stdout.ToArray(), stderr.ToArray(), exit);
        }
        finally
        {
            Console.SetOut(prevOut);
            Console.SetError(prevErr);
        }
    }

    private static string Sample(string name) => Path.Combine(RepoRoot, "sample", name);

    [Fact]
    public void outputs_lowercase_hex_only()
    {
        var (stdout, stderr, exit) = Run("--in", Sample("check.txt"));
        Assert.Equal(0, exit);
        Assert.Empty(stderr);
        Assert.Equal("cbf43926\n"u8.ToArray(), stdout);
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        var (stdout, stderr, exit) = Run("--in", Sample("does-not-exist.bin"));
        Assert.Equal(1, exit);
        Assert.Empty(stdout);
        Assert.Single(Encoding.UTF8.GetString(stderr), c => c == '\n');
        using JsonDocument envelope = JsonDocument.Parse(stderr);
        JsonElement error = envelope.RootElement.GetProperty("error");
        Assert.Equal("INPUT_NOT_FOUND", error.GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(error.GetProperty("message").GetString()));
    }

    [Fact]
    public void exit_codes_usage_vs_data()
    {
        Assert.Equal(0, Run("--in", Sample("check.txt")).Exit);
        Assert.Equal(1, Run("--in", Sample("nope.bin")).Exit);

        Assert.Equal(2, Run().Exit);
        Assert.Equal(2, Run("--foo").Exit);
        Assert.Equal(2, Run("--in").Exit);
        Assert.Equal(2, Run("--in", "a", "b").Exit);
        Assert.Equal(2, Run("positional").Exit);

        using JsonDocument envelope = JsonDocument.Parse(Run("--foo").Stderr);
        Assert.Equal("USAGE", envelope.RootElement.GetProperty("error").GetProperty("code").GetString());
    }

    [Fact]
    public void help_and_version_complete()
    {
        var (stdout, stderr, exit) = Run("--help");
        Assert.Equal(0, exit);
        Assert.Empty(stderr);
        string help = Encoding.UTF8.GetString(stdout);
        Assert.Contains("fastcrc --in <file>", help);
        Assert.Contains("--help", help);
        Assert.Contains("--version", help);
        Assert.Contains("IEEE 802.3", help);
        Assert.Contains("0xEDB88320", help);
        Assert.Contains("init 0xFFFFFFFF", help);
        Assert.Contains("xorout 0xFFFFFFFF", help);
        Assert.Contains("{\"error\":{\"code\":\"USAGE\",\"message\"", help);
        Assert.Contains("0  success", help);
        Assert.Contains("1  data error", help);
        Assert.Contains("2  usage error", help);
        Assert.Contains("cbf43926", help);

        Assert.Equal(0, Run("-h").Exit);
        Assert.Equal("fastcrc 1.0.0\n", Encoding.UTF8.GetString(Run("--version").Stdout));
        Assert.Equal("fastcrc 1.0.0\n", Encoding.UTF8.GetString(Run("-v").Stdout));
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var first = Run("--in", Sample("check.txt"));
        var second = Run("--in", Sample("check.txt"));
        Assert.Equal(0, first.Exit);
        Assert.Equal(first.Stdout, second.Stdout);
        Assert.Equal(first.Stderr, second.Stderr);
    }
}
