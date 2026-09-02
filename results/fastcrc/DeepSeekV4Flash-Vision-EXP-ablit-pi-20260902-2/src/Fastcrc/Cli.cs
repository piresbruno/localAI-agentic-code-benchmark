namespace Fastcrc;

/// The only Console user; argv parsing, error envelope, exit codes.
public static class Cli
{
    private const string Version = "1.0.0";

    public static int RunCli(string[] args)
    {
        if (args.Length == 0) return Error("USAGE", "missing --in");
        if (args[0] == "--help" || args[0] == "-h")
        {
            Console.Write(Help);
            return 0;
        }
        if (args[0] == "--version" || args[0] == "-v")
        {
            Console.WriteLine($"fastcrc {Version}");
            return 0;
        }
        if (args[0] != "--in") return Error("USAGE", $"unknown flag: {args[0]}");
        if (args.Length < 2) return Error("USAGE", "missing value for --in");
        if (args.Length > 2) return Error("USAGE", $"unknown argument: {args[2]}");

        byte[] data;
        try
        {
            data = Io.ReadAllBytes(args[1]);
        }
        catch (FileNotFoundException)
        {
            return Error("INPUT_NOT_FOUND", $"input not found: {args[1]}");
        }
        catch (DirectoryNotFoundException)
        {
            return Error("INPUT_NOT_FOUND", $"input not found: {args[1]}");
        }

        Console.WriteLine(Crc.Crc32(data).ToString("x8"));
        return 0;
    }

    private static int Error(string code, string message)
    {
        Console.Error.WriteLine($"{{\"error\":{{\"code\":\"{code}\",\"message\":\"{message}\"}}}}");
        return code == "USAGE" ? 2 : 1;
    }

    private const string Help =
        "fastcrc — CRC-32 (IEEE 802.3) checksum CLI (version " + Version + ")\n" +
        "\n" +
        "Computes the standard CRC-32/ISO-HDLC checksum of a file and prints it as 8\n" +
        "lowercase hex characters.\n" +
        "\n" +
        "USAGE\n" +
        "  fastcrc --in <file>\n" +
        "  fastcrc --help | -h\n" +
        "  fastcrc --version | -v\n" +
        "\n" +
        "OPTIONS\n" +
        "  --in <file>   Input file; the raw bytes are checksummed. Required.\n" +
        "\n" +
        "OUTPUT\n" +
        "  Exactly one line on stdout: 8 lowercase hex characters + newline.\n" +
        "  No other output for success; errors go to stderr.\n" +
        "\n" +
        "EXIT CODES\n" +
        "  0  Success\n" +
        "  1  Data error: INPUT_NOT_FOUND (input file missing/unreadable)\n" +
        "  2  Usage error: USAGE (no args, unknown flag, missing --in value,\n" +
        "     extra argument)\n" +
        "\n" +
        "ERROR FORMAT\n" +
        "  Every failure prints one single-line JSON object on stderr:\n" +
        "    {\"error\":{\"code\":\"USAGE\",\"message\":\"unknown flag: --foo\"}}\n" +
        "\n" +
        "ALGORITHM\n" +
        "  CRC-32/ISO-HDLC (IEEE 802.3): reflected polynomial 0xEDB88320,\n" +
        "  initial value 0xFFFFFFFF, final XOR 0xFFFFFFFF. Bytes are processed\n" +
        "  LSB-first in the reflected sense; the result is printed as lowercase\n" +
        "  hex, zero-padded to 8 characters.\n" +
        "\n" +
        "EXAMPLE\n" +
        "  fastcrc --in sample/check.txt   # prints cbf43926\n";
}
