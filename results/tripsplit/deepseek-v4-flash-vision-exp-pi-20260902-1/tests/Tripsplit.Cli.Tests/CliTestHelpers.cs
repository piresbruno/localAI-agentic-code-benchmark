using System;
using System.IO;
using Xunit;

[assembly: CollectionBehavior(DisableTestParallelization = true)]

namespace Tripsplit.Cli.Tests;

internal static class CliTestHelpers
{
    internal static (int Exit, string Stdout, string Stderr) Run(params string[] args)
    {
        var outWriter = new StringWriter();
        var errWriter = new StringWriter();
        TextWriter prevOut = Console.Out;
        TextWriter prevErr = Console.Error;
        Console.SetOut(outWriter);
        Console.SetError(errWriter);
        try
        {
            int exit = Program.Main(args);
            return (exit, outWriter.ToString(), errWriter.ToString());
        }
        finally
        {
            Console.SetOut(prevOut);
            Console.SetError(prevErr);
        }
    }

    internal static string WriteJson(string json)
    {
        string path = Path.GetTempFileName();
        File.WriteAllText(path, json);
        return path;
    }

    internal static string MissingPath()
        => Path.Combine(Path.GetTempPath(), "tripsplit-missing-" + Guid.NewGuid().ToString("N") + ".json");

    internal static string Envelope(string code, string message)
        => $"{{\"error\":{{\"code\":\"{code}\",\"message\":\"{message}\"}}}}\n";
}
