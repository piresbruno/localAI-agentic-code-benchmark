namespace Fastcrc;

/// <summary>CLI boundary: argv parsing, stdout/stderr discipline, error envelope, exit codes, help.</summary>
public static class Cli
{
    private const string VersionText = "fastcrc 1.0.0";
    private const int ExitSuccess = 0;
    private const int ExitDataError = 1;
    private const int ExitUsage = 2;

    private const string HelpText = """
    fastcrc 1.0.0 — print the CRC-32 (IEEE 802.3) checksum of a file

    USAGE
      fastcrc --in <file>        print the 8-character lowercase hex checksum of <file>
      fastcrc --help | -h        show this help and exit 0
      fastcrc --version | -v     print version and exit 0

    ALGORITHM
      CRC-32/IEEE 802.3 (ISO-HDLC, the zip/gzip "crc-32"): reflected,
      poly 0xEDB88320, init 0xFFFFFFFF, xorout 0xFFFFFFFF.

    ERRORS
      Failures print one single-line JSON envelope on stderr:
        {"error":{"code":"USAGE","message":"<why>"}}           exit 2
        {"error":{"code":"INPUT_NOT_FOUND","message":"<why>"}} exit 1

    EXIT CODES
      0  success — checksum printed on stdout
      1  data error — input file missing or unreadable (INPUT_NOT_FOUND)
      2  usage error — bad arguments (USAGE)

    EXAMPLE
      $ fastcrc --in sample/check.txt
      cbf43926
    """;

    /// <summary>Runs the CLI in-process and returns the process exit code.</summary>
    public static int RunCli(string[] args)
    {
        if (args.Length == 0)
        {
            return Usage("missing required argument: --in <file>");
        }
        if (args[0] is "--help" or "-h")
        {
            return args.Length == 1 ? Print(HelpText) : Usage($"unexpected argument: {args[1]}");
        }
        if (args[0] is "--version" or "-v")
        {
            return args.Length == 1 ? Print(VersionText) : Usage($"unexpected argument: {args[1]}");
        }
        if (args[0] == "--in")
        {
            return args.Length switch
            {
                1 => Usage("missing value for --in"),
                2 => Checksum(args[1]),
                _ => Usage($"unexpected argument: {args[2]}"),
            };
        }
        return args[0].StartsWith('-') ? Usage($"unknown flag: {args[0]}") : Usage($"unexpected argument: {args[0]}");
    }

    /// <summary>Reads the input bytes via <see cref="Io"/> and prints their checksum.</summary>
    private static int Checksum(string path)
    {
        try
        {
            byte[] bytes = Io.ReadAllBytes(path);
            Print(Crc.Crc32(bytes).ToString("x8"));
            return ExitSuccess;
        }
        catch (IOException ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            return DataError($"input file not found: {path}");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return DataError($"cannot read input file: {path}");
        }
    }

    /// <summary>Writes one line to stdout with a byte-deterministic LF ending; returns 0.</summary>
    private static int Print(string line)
    {
        Console.Out.Write(line + "\n");
        return ExitSuccess;
    }

    private static int Usage(string message)
    {
        WriteError("USAGE", message);
        return ExitUsage;
    }

    private static int DataError(string message)
    {
        WriteError("INPUT_NOT_FOUND", message);
        return ExitDataError;
    }

    /// <summary>Writes the single-line JSON error envelope to stderr.</summary>
    private static void WriteError(string code, string message)
    {
        Console.Error.Write($"{{\"error\":{{\"code\":\"{code}\",\"message\":\"{EscapeJson(message)}\"}}}}\n");
    }

    /// <summary>Escapes the characters that must not appear raw inside a JSON string.</summary>
    private static string EscapeJson(string text) => text
        .Replace("\\", "\\\\")
        .Replace("\"", "\\\"")
        .Replace("\n", "\\n")
        .Replace("\r", "\\r")
        .Replace("\t", "\\t");
}
