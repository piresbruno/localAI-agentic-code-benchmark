using System;
using System.Globalization;
using System.IO;
using System.Text;

namespace Fastcrc;

/// <summary>
/// Argv parsing, error envelope, exit codes, and help text.
/// The only module that touches the Console; in-process test entry.
/// </summary>
public static class Cli
{
    /// <summary>Version reported by --version.</summary>
    public const string Version = "1.0.0";

    /// <summary>Exit code for success.</summary>
    public const int ExitSuccess = 0;

    /// <summary>Exit code for data errors (input unreadable).</summary>
    public const int ExitDataError = 1;

    /// <summary>Exit code for command-line usage errors.</summary>
    public const int ExitUsage = 2;

    private const string HelpText = """
        fastcrc - print the CRC-32 (IEEE 802.3) checksum of a file.

        Usage:
          fastcrc --in <file>        Print the 8-character lowercase hex CRC-32 of <file>.
          fastcrc --help | -h        Show this help and exit.
          fastcrc --version | -v     Show version and exit.

        Flags:
          --in <file>    Required. Path of the file to checksum; its raw bytes are read.

        Exit codes:
          0    success - checksum printed on stdout
          1    data error - INPUT_NOT_FOUND: the input file could not be read
          2    usage error - USAGE: bad command line (unknown flag, missing --in value, extra positional argument)

        Errors are printed as one single-line JSON object on stderr:
          {"error":{"code":"USAGE","message":"unknown flag: --foo"}}

        Algorithm: CRC-32 IEEE 802.3 (ISO-HDLC), reflected - poly 0xEDB88320, init 0xFFFFFFFF, xorout 0xFFFFFFFF.

        Example:
          $ fastcrc --in sample/check.txt
          cbf43926
        """;

    /// <summary>Runs the CLI over <paramref name="args"/> and returns the process exit code.</summary>
    public static int RunCli(string[] args)
    {
        string? inputPath = null;
        for (int i = 0; i < args.Length; i++)
        {
            switch (args[i])
            {
                case "--help" or "-h":
                    Console.Out.Write(HelpText + "\n");
                    return ExitSuccess;
                case "--version" or "-v":
                    Console.Out.Write("fastcrc " + Version + "\n");
                    return ExitSuccess;
                case "--in":
                    if (inputPath != null)
                    {
                        return Usage("duplicate flag: --in");
                    }
                    if (i + 1 >= args.Length || args[i + 1].Length == 0)
                    {
                        return Usage("missing value for --in");
                    }
                    inputPath = args[++i];
                    break;
                default:
                    return args[i].StartsWith('-')
                        ? Usage("unknown flag: " + args[i])
                        : Usage("unexpected positional argument: " + args[i]);
            }
        }

        if (inputPath == null)
        {
            return Usage("missing required flag: --in");
        }

        byte[] data;
        try
        {
            data = Io.ReadAllBytes(inputPath);
        }
        catch (Exception ex) when (ex is FileNotFoundException or DirectoryNotFoundException)
        {
            return DataError("input file not found: " + inputPath);
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return DataError("cannot read input file: " + inputPath);
        }

        string checksum = Crc.Crc32(data).ToString("x8", CultureInfo.InvariantCulture);
        Console.Out.Write(checksum + "\n");
        return ExitSuccess;
    }

    private static int Usage(string message)
    {
        Console.Error.Write(Envelope("USAGE", message) + "\n");
        return ExitUsage;
    }

    private static int DataError(string message)
    {
        Console.Error.Write(Envelope("INPUT_NOT_FOUND", message) + "\n");
        return ExitDataError;
    }

    private static string Envelope(string code, string message)
    {
        return "{\"error\":{\"code\":\"" + code + "\",\"message\":\"" + JsonEscape(message) + "\"}}";
    }

    private static string JsonEscape(string value)
    {
        var sb = new StringBuilder(value.Length);
        foreach (char c in value)
        {
            if (c == '"')
            {
                sb.Append("\\\"");
            }
            else if (c == '\\')
            {
                sb.Append("\\\\");
            }
            else if (c >= 0x20)
            {
                sb.Append(c);
            }
            else
            {
                sb.Append("\\u").Append(((int)c).ToString("x4", CultureInfo.InvariantCulture));
            }
        }
        return sb.ToString();
    }
}
