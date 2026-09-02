using System;
using System.Text.Json;

namespace Fastcrc;

/// <summary>CLI: argv parsing, error envelope, exit codes, help/version.</summary>
public static class Cli
{
    /// <summary>Run the CLI and return the process exit code.</summary>
    public static int RunCli(string[] args)
    {
        if (args.Length == 0)
            return Usage("no arguments: use --in <file>, --help, or --version");

        if ((args[0] == "--help" || args[0] == "-h") && args.Length == 1)
            return Help();

        if ((args[0] == "--version" || args[0] == "-v") && args.Length == 1)
        {
            Console.Out.WriteLine("fastcrc 1.0.0");
            return 0;
        }

        if (args[0] == "--in")
        {
            if (args.Length == 1)
                return Usage("missing value for --in");
            if (args.Length > 2)
                return Usage("unexpected extra arguments");
            return ReadAndPrint(args[1]);
        }

        return Usage(args[0].StartsWith("-") ? "unknown flag: " + args[0] : "unexpected argument: " + args[0]);
    }

    private static int ReadAndPrint(string path)
    {
        byte[] data;
        try
        {
            data = Io.ReadAllBytes(path);
        }
        catch (Exception)
        {
            return DataError("INPUT_NOT_FOUND", "input file could not be read: " + path);
        }

        Console.Out.WriteLine(Crc.Crc32(data).ToString("x8"));
        return 0;
    }

    private static int Usage(string message)
    {
        WriteError("USAGE", message);
        return 2;
    }

    private static int DataError(string code, string message)
    {
        WriteError(code, message);
        return 1;
    }

    private static void WriteError(string code, string message)
    {
        var payload = new { error = new { code, message } };
        Console.Error.WriteLine(JsonSerializer.Serialize(payload));
    }

    private static int Help()
    {
        Console.Out.WriteLine(
            "Fastcrc - CRC-32 (IEEE 802.3) checksum of a file." + Environment.NewLine +
            Environment.NewLine +
            "Usage:" + Environment.NewLine +
            "  fastcrc --in <file>    Print the CRC-32 checksum of <file>." + Environment.NewLine +
            "  fastcrc --help | -h    Show this help and exit 0." + Environment.NewLine +
            "  fastcrc --version | -v Print the version and exit 0." + Environment.NewLine +
            Environment.NewLine +
            "Exit codes:" + Environment.NewLine +
            "  0  success" + Environment.NewLine +
            "  1  data error (input file not found)" + Environment.NewLine +
            "  2  usage error" + Environment.NewLine +
            Environment.NewLine +
            "Errors are printed as one line of JSON on stderr:" + Environment.NewLine +
            "  {\"error\":{\"code\":\"USAGE\",\"message\":\"...\"}}" + Environment.NewLine +
            "  {\"error\":{\"code\":\"INPUT_NOT_FOUND\",\"message\":\"...\"}}" + Environment.NewLine +
            Environment.NewLine +
            "Algorithm: CRC-32 IEEE 802.3 / ISO-HDLC, poly 0xEDB88320, init 0xFFFFFFFF, xorout 0xFFFFFFFF." + Environment.NewLine +
            Environment.NewLine +
            "Example:" + Environment.NewLine +
            "  fastcrc --in sample/check.txt   # prints cbf43926");
        return 0;
    }
}
