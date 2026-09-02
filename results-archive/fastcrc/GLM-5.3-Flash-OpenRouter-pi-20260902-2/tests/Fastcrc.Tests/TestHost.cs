using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Fastcrc.Tests;

/// <summary>In-process harness: runs Cli.RunCli with captured stdout/stderr (spec §8 — no subprocesses).</summary>
internal static class TestHost
{
    public sealed record RunResult(string Stdout, string Stderr, int Exit);

    public static RunResult Run(params string[] args)
    {
        var stdout = new StringWriter();
        var stderr = new StringWriter();
        var realOut = Console.Out;
        var realErr = Console.Error;
        Console.SetOut(stdout);
        Console.SetError(stderr);
        try
        {
            var exit = Cli.RunCli(args);
            return new RunResult(stdout.ToString(), stderr.ToString(), exit);
        }
        finally
        {
            Console.SetOut(realOut);
            Console.SetError(realErr);
        }
    }

    /// <summary>Absolute path of the committed sample fixture (walks up from the test output directory).</summary>
    public static string SamplePath()
    {
        var dir = new DirectoryInfo(AppContext.BaseDirectory);
        while (dir is not null && !File.Exists(Path.Combine(dir.FullName, "sample", "check.txt")))
            dir = dir.Parent;
        if (dir is null)
            throw new FileNotFoundException("sample/check.txt not found above " + AppContext.BaseDirectory);
        return Path.Combine(dir.FullName, "sample", "check.txt");
    }

    /// <summary>Writes a temp file with the given bytes and returns its path.</summary>
    public static string TempFile(byte[] content)
    {
        var path = Path.Combine(Path.GetTempPath(), "fastcrc-tests-" + Path.GetRandomFileName());
        File.WriteAllBytes(path, content);
        return path;
    }
}
