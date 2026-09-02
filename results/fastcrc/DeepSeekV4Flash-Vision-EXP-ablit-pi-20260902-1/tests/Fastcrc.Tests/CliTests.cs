using System.Text;
using Fastcrc;

namespace Fastcrc.Tests;

public class CliTests
{
    private static readonly object CwdLock = new();

    private sealed record CliResult(int ExitCode, string Stdout, string Stderr);

    private static CliResult Run(params string[] args)
    {
        var stdout = new StringWriter();
        var stderr = new StringWriter();
        TextWriter oldOut = Console.Out;
        TextWriter oldErr = Console.Error;
        Console.SetOut(stdout);
        Console.SetError(stderr);
        try
        {
            return new CliResult(Cli.RunCli(args), stdout.ToString(), stderr.ToString());
        }
        finally
        {
            Console.SetOut(oldOut);
            Console.SetError(oldErr);
        }
    }

    private static string SamplePath()
    {
        string? dir = AppContext.BaseDirectory;
        while (dir is not null)
        {
            string candidate = Path.Combine(dir, "sample", "check.txt");
            if (File.Exists(candidate))
                return candidate;
            dir = Path.GetDirectoryName(dir);
        }
        throw new InvalidOperationException("sample/check.txt not found above test output dir");
    }

    [Fact]
    public void outputs_lowercase_hex_only()
    {
        CliResult result = Run("--in", SamplePath());
        Assert.Equal(0, result.ExitCode);
        Assert.Equal("cbf43926\n", result.Stdout);
        Assert.Equal(string.Empty, result.Stderr);
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        string missing = Path.Combine(Path.GetTempPath(), "fastcrc-no-such-file.bin");
        CliResult result = Run("--in", missing);
        Assert.Equal(1, result.ExitCode);
        Assert.Equal(string.Empty, result.Stdout);
        Assert.Equal(
            "{\"error\":{\"code\":\"INPUT_NOT_FOUND\",\"message\":\"file not found: " + missing + "\"}}",
            result.Stderr.TrimEnd('\n'));
    }

    [Fact]
    public void exit_codes_usage_vs_data()
    {
        CliResult noArgs = Run();
        Assert.Equal(2, noArgs.ExitCode);
        Assert.Equal("{\"error\":{\"code\":\"USAGE\",\"message\":\"missing --in argument\"}}", noArgs.Stderr.TrimEnd('\n'));

        CliResult unknown = Run("--foo");
        Assert.Equal(2, unknown.ExitCode);
        Assert.Contains("unknown flag: --foo", unknown.Stderr);

        CliResult missingValue = Run("--in");
        Assert.Equal(2, missingValue.ExitCode);
        Assert.Contains("USAGE", missingValue.Stderr);

        CliResult extra = Run("--in", SamplePath(), "extra");
        Assert.Equal(2, extra.ExitCode);
        Assert.Contains("unexpected argument: extra", extra.Stderr);
        Assert.Contains("USAGE", extra.Stderr);
    }

    [Fact]
    public void help_and_version_complete()
    {
        CliResult help = Run("--help");
        Assert.Equal(0, help.ExitCode);
        string text = help.Stdout;
        Assert.Contains("fastcrc --in <file>", text);
        Assert.Contains("fastcrc --help | -h", text);
        Assert.Contains("fastcrc --version | -v", text);
        Assert.Contains("Exit codes:", text);
        Assert.Contains("0  success", text);
        Assert.Contains("1  data error", text);
        Assert.Contains("2  usage error", text);
        Assert.Contains("{\"error\":{\"code\":\"USAGE\",\"message\":\"unknown flag: --foo\"}}", text);
        Assert.Contains("INPUT_NOT_FOUND", text);
        Assert.Contains("0xEDB88320", text);
        Assert.Contains("initial value 0xFFFFFFFF", text);
        Assert.Contains("final XOR 0xFFFFFFFF", text);
        Assert.Contains("cbf43926", text);

        CliResult shortHelp = Run("-h");
        Assert.Equal(0, shortHelp.ExitCode);
        Assert.Equal(help.Stdout, shortHelp.Stdout);

        CliResult version = Run("--version");
        Assert.Equal(0, version.ExitCode);
        Assert.Equal("fastcrc 1.0.0\n", version.Stdout);
        Assert.Equal(version.Stdout, Run("-v").Stdout);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        CliResult first = Run("--in", SamplePath());
        CliResult second = Run("--in", SamplePath());
        Assert.Equal(0, first.ExitCode);
        Assert.Equal(first.ExitCode, second.ExitCode);
        Assert.True(Encoding.UTF8.GetBytes(first.Stdout).SequenceEqual(Encoding.UTF8.GetBytes(second.Stdout)));
        Assert.Equal(first.Stderr, second.Stderr);
    }

    [Fact]
    public void cli_golden_sample_relative_path()
    {
        string sample = SamplePath();
        string runRoot = Path.GetDirectoryName(Path.GetDirectoryName(sample))!;
        lock (CwdLock)
        {
            string oldCwd = Directory.GetCurrentDirectory();
            Directory.SetCurrentDirectory(runRoot);
            try
            {
                CliResult result = Run("--in", "sample/check.txt");
                Assert.Equal(0, result.ExitCode);
                Assert.Equal("cbf43926\n", result.Stdout);
            }
            finally
            {
                Directory.SetCurrentDirectory(oldCwd);
            }
        }
    }
}
