using System;
using System.Text.Json;

namespace Fastcrc;

/// <summary>Argv parsing, the JSON error envelope, exit codes and help text.</summary>
public static class Cli
{
    private const string Help =
        "usage: fastcrc --in <file>\n" +
        "\n" +
        "Prints the CRC-32 (IEEE 802.3 / ISO-HDLC) checksum of a file as 8\n" +
        "lowercase hex characters followed by a newline.\n" +
        "\n" +
        "options:\n" +
        "  --in <file>       read raw bytes from <file> and print its CRC-32\n" +
        "  -h, --help        show this help and exit\n" +
        "  -v, --version     print version and exit\n" +
        "\n" +
        "algorithm:\n" +
        "  CRC-32 IEEE 802.3 / ISO-HDLC: poly 0xEDB88320, init 0xFFFFFFFF, xorout 0xFFFFFFFF\n" +
        "\n" +
        "exit codes:\n" +
        "  0  success (checksum printed to stdout)\n" +
        "  1  data error (e.g. input file not found)\n" +
        "  2  usage error (missing or unknown flags / arguments)\n" +
        "\n" +
        "errors are reported as one JSON line on stderr:\n" +
        "  {\"error\":{\"code\":\"USAGE\",\"message\":\"unknown flag: --foo\"}}\n" +
        "\n" +
        "example:\n" +
        "  fastcrc --in sample/check.txt    # prints cbf43926\n";

    /// <summary>Entry point used by <c>Program.cs</c>; returns the process exit code.</summary>
    public static int RunCli(string[] args)
    {
        if (args.Length == 0)
        {
            return Error("USAGE", "missing required flag --in");
        }

        if (args.Length == 1 && (args[0] == "--help" || args[0] == "-h"))
        {
            Console.Out.Write(Help);
            return 0;
        }

        if (args.Length == 1 && (args[0] == "--version" || args[0] == "-v"))
        {
            Console.Out.WriteLine("fastcrc 1.0.0");
            return 0;
        }

        if (args[0] != "--in")
        {
            return Error("USAGE", $"unknown flag: {args[0]}");
        }

        if (args.Length != 2)
        {
            return Error("USAGE", args.Length < 2 ? "missing value for --in" : $"unexpected argument: {args[2]}");
        }

        byte[] bytes;
        try
        {
            bytes = Io.ReadAllBytes(args[1]);
        }
        catch (Exception)
        {
            return Error("INPUT_NOT_FOUND", $"input file not found: {args[1]}");
        }

        Console.Out.WriteLine(Crc.Crc32(bytes).ToString("x8"));
        return 0;
    }

    private static int Error(string code, string message)
    {
        Console.Error.WriteLine(JsonSerializer.Serialize(new { error = new { code, message } }));
        return code == "USAGE" ? 2 : 1;
    }
}
