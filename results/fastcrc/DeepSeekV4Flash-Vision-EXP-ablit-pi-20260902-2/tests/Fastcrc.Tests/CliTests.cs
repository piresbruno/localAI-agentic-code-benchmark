using System;
using System.IO;
using System.Text;
using System.Text.Json;
using Xunit;

namespace Fastcrc.Tests;

/// <summary>R4-R8: boundary tests through <c>Cli.RunCli</c> with Console capture (in-process).</summary>
public class CliTests
{
    [Fact]
    public void outputs_lowercase_hex_only()
    {
        // R4: stdout is exactly 8 lowercase hex chars + newline; nothing else; no ANSI.
        string path = WriteTempFile(Encoding.ASCII.GetBytes("123456789"));
        try
        {
            (int exit, string stdout, string stderr) = Run("--in", path);
            Assert.Equal(0, exit);
            Assert.Equal("cbf43926\n", stdout);
            Assert.Equal(string.Empty, stderr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void rejects_missing_input_file()
    {
        // R5: INPUT_NOT_FOUND envelope, exit 1.
        string missing = Path.Combine(Path.GetTempPath(), "fastcrc_missing_input_test.txt");
        File.Delete(missing);
        (int exit, string stdout, string stderr) = Run("--in", missing);
        Assert.Equal(1, exit);
        Assert.Equal(string.Empty, stdout);
        AssertError(stderr, "INPUT_NOT_FOUND");
    }

    [Fact]
    public void exit_codes_usage_vs_data()
    {
        // R6: 0 success; 1 data; 2 usage (no args, unknown flag, missing --in value, extra positional).
        string path = WriteTempFile(Encoding.ASCII.GetBytes("abc"));
        try
        {
            (int okExit, string okOut, _) = Run("--in", path);
            Assert.Equal(0, okExit);
            Assert.Equal("352441c2\n", okOut);

            (int dataExit, _, string dataErr) = Run("--in", Path.Combine(Path.GetTempPath(), "fastcrc_absent_files_000.txt"));
            Assert.Equal(1, dataExit);
            AssertError(dataErr, "INPUT_NOT_FOUND");

            AssertUsage(Run(), "USAGE");
            AssertUsage(Run("--foo"), "USAGE");
            AssertUsage(Run("--in"), "USAGE");
            AssertUsage(Run("--in", path, "extra"), "USAGE");
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void help_and_version_complete()
    {
        // R7: --help exit 0 documents command, flags, exit codes, envelope, algorithm; --version prints fastcrc 1.0.0.
        (int helpExit, string help, string helpErr) = Run("--help");
        Assert.Equal(0, helpExit);
        Assert.Equal(string.Empty, helpErr);
        Assert.Contains("fastcrc --in <file>", help);
        Assert.Contains("--in <file>", help);
        Assert.Contains("exit codes", help);
        Assert.Contains(" 0", help);
        Assert.Contains(" 1", help);
        Assert.Contains(" 2", help);
        Assert.Contains("{\"error\":{\"code\":\"USAGE\",\"message\":\"unknown flag: --foo\"}}", help);
        Assert.Contains("IEEE 802.3", help);
        Assert.Contains("0xEDB88320", help);
        Assert.Contains("init 0xFFFFFFFF", help);
        Assert.Contains("xorout 0xFFFFFFFF", help);
        Assert.Contains("cbf43926", help);

        (int hExit, _, _) = Run("-h");
        Assert.Equal(0, hExit);

        (int vExit, string version, string vErr) = Run("--version");
        Assert.Equal(0, vExit);
        Assert.Equal("fastcrc 1.0.0\n", version);
        Assert.Equal(string.Empty, vErr);

        (int shortVExit, string shortVersion, _) = Run("-v");
        Assert.Equal(0, shortVExit);
        Assert.Equal("fastcrc 1.0.0\n", shortVersion);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        // R8: run twice against the same input, byte-compare.
        string path = WriteTempFile(Encoding.ASCII.GetBytes("repeat-me-123"));
        try
        {
            (_, string firstOut, string firstErr) = Run("--in", path);
            (_, string secondOut, string secondErr) = Run("--in", path);
            Assert.Equal(Encoding.UTF8.GetBytes(firstOut), Encoding.UTF8.GetBytes(secondOut));
            Assert.Equal(firstErr, secondErr);
        }
        finally
        {
            File.Delete(path);
        }
    }

    [Fact]
    public void golden_output_for_sample_check()
    {
        // Golden: RunCli(["--in","sample/check.txt"]) -> cbf43926\n, exit 0.
        string path = FindSampleCheck();
        (int exit, string stdout, string stderr) = Run("--in", path);
        Assert.Equal(0, exit);
        Assert.Equal("cbf43926\n", stdout);
        Assert.Equal(string.Empty, stderr);
    }

    private static (int Exit, string Stdout, string Stderr) Run(params string[] args)
    {
        var outWriter = new StringWriter();
        var errWriter = new StringWriter();
        TextWriter originalOut = Console.Out;
        TextWriter originalErr = Console.Error;
        int exit;
        try
        {
            Console.SetOut(outWriter);
            Console.SetError(errWriter);
            exit = Cli.RunCli(args);
        }
        finally
        {
            Console.SetOut(originalOut);
            Console.SetError(originalErr);
        }
        return (exit, outWriter.ToString(), errWriter.ToString());
    }

    private static void AssertUsage((int Exit, string Stdout, string Stderr) result, string code)
    {
        Assert.Equal(2, result.Exit);
        Assert.Equal(string.Empty, result.Stdout);
        AssertError(result.Stderr, code);
    }

    private static void AssertError(string stderr, string code)
    {
        using JsonDocument doc = JsonDocument.Parse(stderr.Trim());
        Assert.Equal(code, doc.RootElement.GetProperty("error").GetProperty("code").GetString());
        Assert.False(string.IsNullOrWhiteSpace(doc.RootElement.GetProperty("error").GetProperty("message").GetString()));
        Assert.Single(stderr.Trim().Split('\n')); // exactly one line
    }

    private static string WriteTempFile(byte[] content)
    {
        string path = Path.GetTempFileName();
        File.WriteAllBytes(path, content);
        return path;
    }

    private static string FindSampleCheck()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir != null)
        {
            string candidate = Path.Combine(dir.FullName, "sample", "check.txt");
            if (File.Exists(candidate))
            {
                return candidate;
            }
            dir = dir.Parent;
        }
        throw new FileNotFoundException("sample/check.txt not found above test assembly");
    }
}
