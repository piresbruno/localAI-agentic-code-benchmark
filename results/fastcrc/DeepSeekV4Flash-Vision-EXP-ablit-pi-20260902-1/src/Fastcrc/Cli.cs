namespace Fastcrc;

/// <summary>argv parsing, error envelope, exit codes and help. The only module touching Console.</summary>
public static class Cli
{
    public const string VersionText = "fastcrc 1.0.0";

    /// <summary>Runs the CLI in-process. Returns the process exit code.</summary>
    public static int RunCli(string[] args)
    {
        if (args.Length == 0)
            return Usage("missing --in argument");
        switch (args[0])
        {
            case "--help":
            case "-h":
                Console.Out.Write(HelpText);
                return 0;
            case "--version":
            case "-v":
                Console.Out.WriteLine(VersionText);
                return 0;
            case "--in":
                if (args.Length == 2)
                    return Checksum(args[1]);
                return args.Length < 2
                    ? Usage("--in requires a file argument")
                    : Usage($"unexpected argument: {args[^1]}");
            default:
                return Usage($"unknown flag: {args[0]}");
        }
    }

    private static int Checksum(string path)
    {
        byte[] data;
        try
        {
            data = Io.ReadAllBytes(path);
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            Error("INPUT_NOT_FOUND", $"file not found: {path}");
            return 1;
        }
        Console.Out.WriteLine(Crc.Crc32(data).ToString("x8"));
        return 0;
    }

    private static int Usage(string message)
    {
        Error("USAGE", message);
        return 2;
    }

    private static void Error(string code, string message)
    {
        string safe = message.Replace("\\", "\\\\").Replace("\"", "\\\"");
        Console.Error.WriteLine($"{{\"error\":{{\"code\":\"{code}\",\"message\":\"{safe}\"}}}}");
    }

    private const string HelpText =
        "fastcrc — print the CRC-32 (IEEE 802.3 / ISO-HDLC) checksum of a file\n" +
        "\n" +
        "Usage:\n" +
        "  fastcrc --in <file>      Read <file> raw bytes and print the 8-character\n" +
        "                           lowercase hex CRC-32 checksum followed by a newline.\n" +
        "  fastcrc --help | -h      Show this help.\n" +
        "  fastcrc --version | -v   Print version.\n" +
        "\n" +
        "Exit codes:\n" +
        "  0  success\n" +
        "  1  data error (e.g. input file not found)\n" +
        "  2  usage error (no args, unknown flag, missing --in value, extra positional)\n" +
        "\n" +
        "Errors are printed to stderr as one single-line JSON object:\n" +
        "  {\"error\":{\"code\":\"USAGE\",\"message\":\"unknown flag: --foo\"}}\n" +
        "  Codes: USAGE (exit 2), INPUT_NOT_FOUND (exit 1)\n" +
        "\n" +
        "Algorithm: CRC-32 IEEE 802.3 (ISO-HDLC), reflected polynomial 0xEDB88320,\n" +
        "initial value 0xFFFFFFFF, final XOR 0xFFFFFFFF; output is 8 lowercase hex digits.\n" +
        "\n" +
        "Example:\n" +
        "  fastcrc --in sample/check.txt\n" +
        "  cbf43926\n";
}
