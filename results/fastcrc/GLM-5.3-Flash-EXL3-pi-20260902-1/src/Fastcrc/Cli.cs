using System.Text.Encodings.Web;
using System.Text.Json;

namespace Fastcrc;

/// <summary>Argv parsing, help/version output, the JSON error envelope and exit codes. In-process entry point.</summary>
public static class Cli
{
    private const string Version = "1.0.0";
    private const int Ok = 0;
    private const int DataError = 1;
    private const int UsageError = 2;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    private const string Help = """
        fastcrc — prints the CRC-32 (IEEE 802.3) checksum of a file.

        Usage:
          fastcrc --in <file>
          fastcrc --help | -h
          fastcrc --version | -v

        Options:
          --in <file>    Read <file> as raw bytes and print its CRC-32 checksum
                         as 8 lowercase hex characters followed by a newline.
          -h, --help     Show this help and exit with code 0.
          -v, --version  Print "fastcrc 1.0.0" and exit with code 0.

        Exit codes:
          0  success — checksum printed on stdout
          1  data error — the input file could not be read (INPUT_NOT_FOUND)
          2  usage error — invalid command line (USAGE)

        Errors:
          Every failure prints one single-line JSON object to stderr:
            {"error":{"code":"USAGE","message":"<detail>"}}
          Codes: USAGE (exit 2), INPUT_NOT_FOUND (exit 1).

        Algorithm:
          CRC-32 IEEE 802.3 (ISO-HDLC): poly 0xEDB88320 (reflected),
          init 0xFFFFFFFF, xorout 0xFFFFFFFF.

        Example:
          $ fastcrc --in sample/check.txt
          cbf43926
        """;

    /// <summary>Runs the CLI and returns the process exit code: 0 success, 1 data error, 2 usage error.</summary>
    public static int RunCli(string[] args)
    {
        if (args.Length == 0)
            return Error("USAGE", "no arguments; expected --in <file> (run with --help for usage)", UsageError);
        if (args is ["--help"] or ["-h"])
        {
            Console.Write(Help);
            return Ok;
        }
        if (args is ["--version"] or ["-v"])
        {
            Console.WriteLine($"fastcrc {Version}");
            return Ok;
        }
        if (args[0] != "--in")
            return args[0].StartsWith('-')
                ? Error("USAGE", $"unknown flag: {args[0]}", UsageError)
                : Error("USAGE", $"unexpected positional argument: {args[0]}", UsageError);
        if (args.Length == 1)
            return Error("USAGE", "missing value for --in", UsageError);
        if (args.Length > 2)
            return Error("USAGE", $"unexpected extra argument: {args[2]}", UsageError);
        try
        {
            byte[] data = Io.ReadAllBytes(args[1]);
            Console.WriteLine(Crc.Crc32(data).ToString("x8"));
            return Ok;
        }
        catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException or UnauthorizedAccessException or IOException)
        {
            return Error("INPUT_NOT_FOUND", $"cannot read input file: {args[1]}", DataError);
        }
    }

    /// <summary>Prints the single-line JSON error envelope to stderr and returns the mapped exit code.</summary>
    private static int Error(string code, string message, int exit)
    {
        Console.Error.WriteLine(JsonSerializer.Serialize(new { error = new { code, message } }, JsonOptions));
        return exit;
    }
}
