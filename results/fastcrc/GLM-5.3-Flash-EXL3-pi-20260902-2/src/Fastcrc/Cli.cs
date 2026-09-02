using System;

/// <summary>
/// Argv parsing, error envelope, exit codes, and help text.
/// The only module that touches the Console; in-process test entry.
/// </summary>
public static class Cli
{
    /// <summary>Runs the CLI over <paramref name="args"/> and returns the process exit code.</summary>
    public static int RunCli(string[] args) => throw new NotSupportedException("not implemented");
}
