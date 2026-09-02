using System.Text.Encodings.Web;
using System.Text.Json;

namespace Fastcrc;

/// <summary>CLI boundary: argv parsing, error envelope, exit codes, help.</summary>
public static class Cli
{
    private const string Version = "fastcrc 1.0.0";

    private const string Help = """
        fastcrc — print the CRC-32 (IEEE 802.3) checksum of a file

        USAGE
          fastcrc --in <file>

        FLAGS
          --in <file>   read <file> as raw bytes and print its checksum (required)
          -h, --help    show this help and exit 0
          -v, --version print version and exit 0

        ALGORITHM
          CRC-32/IEEE 802.3 (ISO-HDLC, the zip/gzip "CRC-32"):
          poly 0xEDB88320 (reflected), init 0xFFFFFFFF, xorout 0xFFFFFFFF.
          Output: 8 lowercase hex characters, zero-padded, one line on stdout.

        EXAMPLE
          fastcrc --in sample/check.txt   →   cbf43926

        EXIT CODES
          0  success
          1  data error (input file could not be found or read)
          2  usage error (bad or missing arguments)

        ERRORS
          Any failure prints one single-line JSON object on stderr:
          {"error":{"code":"USAGE","message":"unknown flag: --foo"}}
          Codes: USAGE (exit 2), INPUT_NOT_FOUND (exit 1).
        """;

    /// <summary>Runs the CLI and returns the process exit code (in-process test entry).</summary>
    public static int RunCli(string[] args)
    {
        string? input = null;
        for (var i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--in" when i + 1 >= args.Length:
                    return Fail("USAGE", "missing value for --in", 2);
                case "--in":
                    input = args[++i];
                    break;
                case "-h":
                case "--help":
                    Console.Out.Write(Help + "\n");
                    return 0;
                case "-v":
                case "--version":
                    Console.Out.Write(Version + "\n");
                    return 0;
                default:
                    return Usage(args[i].StartsWith('-')
                        ? $"unknown flag: {args[i]}"
                        : $"unexpected argument: {args[i]}");
            }
        }

        if (input is null)
            return Usage("no arguments; expected --in <file>");

        byte[] bytes;
        try
        {
            bytes = Io.ReadAllBytes(input);
        }
        catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException
                                 or IOException or UnauthorizedAccessException)
        {
            return Fail("INPUT_NOT_FOUND", e is FileNotFoundException or DirectoryNotFoundException
                ? $"input file not found: {input}" : $"cannot read input file: {input}", 1);
        }

        Console.Out.Write($"{Crc.Crc32(bytes):x8}\n");
        return 0;
    }

    private static int Usage(string message) => Fail("USAGE", message, 2);

    private static readonly JsonSerializerOptions JsonOptions = new() { Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping };

    private static int Fail(string code, string message, int exit)
    {
        Console.Error.WriteLine(JsonSerializer.Serialize(new { error = new { code, message } }, JsonOptions));
        return exit;
    }
}
