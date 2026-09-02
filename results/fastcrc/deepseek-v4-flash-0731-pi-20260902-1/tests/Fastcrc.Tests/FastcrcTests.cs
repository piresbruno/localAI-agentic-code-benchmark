using System.Text;
using System.Text.RegularExpressions;
using Fastcrc;
using Xunit;

namespace Fastcrc.Tests;

/// <summary>
/// Spec §5 business rules R1–R8, each with a test named for the rule, all
/// in-process (no subprocess launches).
/// </summary>
public class FastcrcTests
{
    // --- R1–R3: algorithm, direct Crc.Crc32 calls -------------------------

    [Fact]
    public void computes_pinned_crc32_check_values()
    {
        Assert.Equal(0xCBF43926u, Crc.Crc32(Encoding.ASCII.GetBytes("123456789")));
        Assert.Equal(0x352441C2u, Crc.Crc32(Encoding.ASCII.GetBytes("abc")));
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

        byte[] longData = new byte[1024 * 1024];
        Array.Fill(longData, (byte)0xAB);
        Assert.Equal(0xB8CC1630u, Crc.Crc32(longData));
        // deterministic on repeated runs
        Assert.Equal(Crc.Crc32(longData), Crc.Crc32(longData));
    }

    // --- R4–R8: CLI surface, in-process with console capture --------------

    [Fact]
    public void golden_check_file_prints_cbf43926()
    {
        var run = RunCli(["--in", "sample/check.txt"]);
        Assert.Equal(0, run.ExitCode);
        Assert.Equal("cbf43926\n", run.StdOut);
        Assert.Equal("", run.StdErr);
    }

    [Fact]
    public void outputs_lowercase_hex_only()
    {
        var run = RunCli(["--in", "sample/check.txt"]);
        Assert.Equal(0, run.ExitCode);
                Assert.Matches(new Regex("^[0-9a-f]{8}\n$"), run.StdOut);
        // no ANSI escapes; char-code comparison is culture-free (xunit's
        // string DoesNotContain uses culture search, where ESC is ignorable)
        Assert.DoesNotContain((char)0x1B, run.StdOut);
        Assert.Equal("", run.StdErr);
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        var run = RunCli(["--in", "no-such-file.txt"]);
        Assert.Equal(1, run.ExitCode);
        Assert.Equal("", run.StdOut);
        Assert.Equal(
            "{\"error\":{\"code\":\"INPUT_NOT_FOUND\",\"message\":\"file not found: no-such-file.txt\"}}\n",
            run.StdErr);
    }

    [Fact]
    public void exit_codes_usage_vs_data()
    {
        // 0 success
        Assert.Equal(0, RunCli(["--in", "sample/check.txt"]).ExitCode);
        // 1 data error
        Assert.Equal(1, RunCli(["--in", "no-such-file.txt"]).ExitCode);
        // 2 usage: no args, unknown flag, missing --in value, extra positional
        Assert.Equal(2, RunCli([]).ExitCode);
        Assert.Equal(2, RunCli(["--foo"]).ExitCode);
        Assert.Equal(2, RunCli(["--in"]).ExitCode);
        Assert.Equal(2, RunCli(["--in", "sample/check.txt", "extra"]).ExitCode);

        Assert.Equal(
            "{\"error\":{\"code\":\"USAGE\",\"message\":\"unknown flag: --foo\"}}\n",
            RunCli(["--foo"]).StdErr);
        Assert.Equal(
            "{\"error\":{\"code\":\"USAGE\",\"message\":\"missing value for --in\"}}\n",
            RunCli(["--in"]).StdErr);
    }

    [Fact]
    public void help_and_version_complete()
    {
        var help = RunCli(["--help"]);
        Assert.Equal(0, help.ExitCode);
        Assert.Equal("", help.StdErr);
        Assert.Contains("Usage: fastcrc", help.StdOut);
        Assert.Contains("--in <file>", help.StdOut);
        Assert.Contains("0  success", help.StdOut);
        Assert.Contains("1  data error", help.StdOut);
        Assert.Contains("2  usage error", help.StdOut);
        Assert.Contains("{\"error\":{\"code\":\"USAGE\"", help.StdOut);
        Assert.Contains("INPUT_NOT_FOUND", help.StdOut);
        Assert.Contains("IEEE 802.3", help.StdOut);
        Assert.Contains("0xEDB88320", help.StdOut);
        Assert.Contains("0xFFFFFFFF", help.StdOut);
        Assert.Contains("fastcrc --in sample/check.txt", help.StdOut);

        var version = RunCli(["--version"]);
        Assert.Equal(0, version.ExitCode);
        Assert.Equal("fastcrc 1.0.0\n", version.StdOut);
        Assert.Equal("", version.StdErr);

        Assert.Equal(0, RunCli(["-h"]).ExitCode);
        Assert.Equal("fastcrc 1.0.0\n", RunCli(["-v"]).StdOut);

        // stray arguments after help/version are usage errors
        Assert.Equal(2, RunCli(["--help", "extra"]).ExitCode);
        Assert.Equal(2, RunCli(["--version", "extra"]).ExitCode);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var first = RunCli(["--in", "sample/check.txt"]);
        var second = RunCli(["--in", "sample/check.txt"]);
        Assert.Equal(first.ExitCode, second.ExitCode);
        Assert.Equal(first.StdOut, second.StdOut);
        Assert.Equal(first.StdErr, second.StdErr);
        Assert.Equal("cbf43926\n", first.StdOut);
    }

    [Fact]
    public void program_main_propagates_runcli_exit_code()
    {
        var originalOut = Console.Out;
        var originalError = Console.Error;
        try
        {
            Console.SetOut(new StringWriter());
            Console.SetError(new StringWriter());
            Assert.Equal(0, Program.Main(["--version"]));
            Assert.Equal(2, Program.Main([]));
            Assert.Equal(1, Program.Main(["--in", "no-such-file.txt"]));
        }
        finally
        {
            Console.SetOut(originalOut);
            Console.SetError(originalError);
        }
    }

    // --- helpers -----------------------------------------------------------

    private static (int ExitCode, string StdOut, string StdErr) RunCli(string[] args)
    {
        var stdout = new StringWriter();
        var stderr = new StringWriter();
        var originalOut = Console.Out;
        var originalError = Console.Error;
        try
        {
            Console.SetOut(stdout);
            Console.SetError(stderr);
            return (Cli.RunCli(args), stdout.ToString(), stderr.ToString());
        }
        finally
        {
            Console.SetOut(originalOut);
            Console.SetError(originalError);
        }
    }
}