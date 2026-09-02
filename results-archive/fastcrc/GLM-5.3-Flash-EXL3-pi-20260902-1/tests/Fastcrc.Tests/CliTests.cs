using System.Text;
using System.Text.Json;
using Fastcrc;

namespace Fastcrc.Tests;

/// <summary>R4–R8: CLI boundary rules, exercised in-process via Cli.RunCli with console capture.</summary>
public class CliTests
{
    private static readonly string CheckFile = FindRepoFile(Path.Combine("sample", "check.txt"));

    private static string FindRepoFile(string relative)
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, relative)))
            dir = dir.Parent;
        return dir is null
            ? throw new InvalidOperationException($"could not locate {relative} above {AppContext.BaseDirectory}")
            : Path.Combine(dir.FullName, relative);
    }

    private static (string Stdout, string Stderr, int Exit) Run(params string[] args)
    {
        TextWriter originalOut = Console.Out, originalErr = Console.Error;
        var stdout = new StringWriter();
        var stderr = new StringWriter();
        Console.SetOut(stdout);
        Console.SetError(stderr);
        try
        {
            int exit = Cli.RunCli(args);
            return (stdout.ToString(), stderr.ToString(), exit);
        }
        finally
        {
            Console.SetOut(originalOut);
            Console.SetError(originalErr);
        }
    }

    private static string MissingFile()
    {
        string missing = Path.Combine(Path.GetTempPath(), "fastcrc-tests-missing.bin");
        File.Delete(missing); // guarantee absence
        return missing;
    }

    private static void AssertSingleLineEnvelope(string stderr, string code, string message)
    {
        Assert.Equal(1, stderr.Count(c => c == '\n'));
        Assert.EndsWith("\n", stderr, StringComparison.Ordinal);
        using var doc = JsonDocument.Parse(stderr);
        JsonElement error = doc.RootElement.GetProperty("error");
        Assert.Equal(code, error.GetProperty("code").GetString());
        Assert.Equal(message, error.GetProperty("message").GetString());
    }

    [Fact]
    public void outputs_lowercase_hex_only()
    {
        var (stdout, stderr, exit) = Run("--in", CheckFile);

        Assert.Equal(0, exit);
        Assert.Equal("cbf43926\n", stdout);
        Assert.Equal(string.Empty, stderr);
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        string missing = MissingFile();

        var (stdout, stderr, exit) = Run("--in", missing);

        Assert.Equal(1, exit);
        Assert.Equal(string.Empty, stdout);
        AssertSingleLineEnvelope(stderr, "INPUT_NOT_FOUND", $"cannot read input file: {missing}");
    }

    [Fact]
    public void exit_codes_usage_vs_data()
    {
        Assert.Equal(0, Run("--in", CheckFile).Exit);
        Assert.Equal(1, Run("--in", MissingFile()).Exit);

        Assert.Equal(2, Run().Exit);
        Assert.Equal(2, Run("--bogus").Exit);
        Assert.Equal(2, Run("--in").Exit);
        Assert.Equal(2, Run("--in", CheckFile, "extra").Exit);
    }

    [Fact]
    public void help_and_version_complete()
    {
        var (helpOut, helpErr, helpExit) = Run("--help");

        Assert.Equal(0, helpExit);
        Assert.Equal(string.Empty, helpErr);
        Assert.Contains("fastcrc --in <file>", helpOut);            // the command
        Assert.Contains("--in <file>    Read <file>", helpOut);     // --in with meaning
        Assert.Contains("0  success", helpOut);                     // exit codes
        Assert.Contains("1  data error", helpOut);
        Assert.Contains("2  usage error", helpOut);
        Assert.Contains("\"error\":{\"code\":\"USAGE\"", helpOut);  // envelope shape
        Assert.Contains("INPUT_NOT_FOUND", helpOut);
        Assert.Contains("IEEE 802.3", helpOut);                     // algorithm line
        Assert.Contains("0xEDB88320", helpOut);
        Assert.Contains("init 0xFFFFFFFF", helpOut);
        Assert.Contains("xorout 0xFFFFFFFF", helpOut);
        Assert.Contains("cbf43926", helpOut);                       // worked example

        Assert.Equal((helpOut, 0), (Run("-h").Stdout, Run("-h").Exit));

        var (vOut, vErr, vExit) = Run("--version");
        Assert.Equal(0, vExit);
        Assert.Equal(string.Empty, vErr);
        Assert.Equal("fastcrc 1.0.0\n", vOut);
        Assert.Equal("fastcrc 1.0.0\n", Run("-v").Stdout);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var first = Run("--in", CheckFile);
        var second = Run("--in", CheckFile);

        Assert.Equal(Encoding.UTF8.GetBytes(first.Stdout), Encoding.UTF8.GetBytes(second.Stdout));
        Assert.Equal(first.Exit, second.Exit);
    }
}
