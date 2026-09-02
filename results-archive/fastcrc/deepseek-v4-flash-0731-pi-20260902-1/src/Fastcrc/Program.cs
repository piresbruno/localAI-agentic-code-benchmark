namespace Fastcrc;

/// <summary>Entry-point shim; returns the exit code from the CLI module.</summary>
public static class Program
{
    /// <summary>Process entry point.</summary>
    public static int Main(string[] args) => Cli.RunCli(args);
}