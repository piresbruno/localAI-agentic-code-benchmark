using System.Text.Json;

namespace Fastcrc;

/// <summary>
/// Command-line surface: argument parsing, error envelope, exit codes and
/// help text. The only module that touches the console.
/// </summary>
public static class Cli
{
    /// <summary>Program version, pinned by the spec.</summary>
    public const string Version = "1.0.0";

    private const string Help = """
        Usage: fastcrc [options]

        Computes the CRC-32 (IEEE 802.3 / ISO-HDLC) checksum of a file and prints
        the 8-character lowercase hexadecimal checksum.

        Options:
          --in <file>     Read <file> and print its CRC-32 checksum (required)
          --help, -h      Show this help and exit
          --version, -v   Print the version and exit

        Exit codes:
          0  success
          1  data error (e.g. input file not found)
          2  usage error (unknown flag, missing or extra arguments)

        Errors are printed to stderr as a single-line JSON object:
          {"error":{"code":"USAGE","message":"unknown flag: --foo"}}
        Codes: USAGE (exit 2), INPUT_NOT_FOUND (exit 1).

        Algorithm: CRC-32, IEEE 802.3 / ISO-HDLC; polynomial 0xEDB88320
        (reflected), initial value 0xFFFFFFFF, final xor 0xFFFFFFFF.

        Example:
          fastcrc --in sample/check.txt
        """;

    /// <summary>
    /// Runs the CLI: parses <paramref name="args"/>, reads and checksums the
    /// file, and returns the process exit code.
    /// </summary>
    public static int RunCli(string[] args)
    {
        if (args.Length == 0)
        {
            return Error(2, "USAGE", "missing arguments");
        }

        switch (args[0])
        {
            case "--help":
            case "-h":
                if (args.Length > 1)
                {
                    return Error(2, "USAGE", $"unexpected argument: {args[1]}");
                }
                Console.Out.Write(Help);
                return 0;

            case "--version":
            case "-v":
                if (args.Length > 1)
                {
                    return Error(2, "USAGE", $"unexpected argument: {args[1]}");
                }
                Console.Out.WriteLine($"fastcrc {Version}");
                return 0;

            case "--in":
                if (args.Length < 2)
                {
                    return Error(2, "USAGE", "missing value for --in");
                }
                if (args.Length > 2)
                {
                    return Error(2, "USAGE", $"unexpected argument: {args[2]}");
                }
                return Checksum(args[1]);

            default:
                return Error(2, "USAGE", $"unknown flag: {args[0]}");
        }
    }

    private static int Checksum(string path)
    {
        byte[] data;
        try
        {
            data = Io.ReadAllBytes(path);
        }
        catch (FileNotFoundException)
        {
            return Error(1, "INPUT_NOT_FOUND", $"file not found: {path}");
        }
        catch (IOException)
        {
            return Error(1, "INPUT_NOT_FOUND", $"cannot read file: {path}");
        }

        Console.Out.WriteLine(Crc.Crc32(data).ToString("x8"));
        return 0;
    }

    private static int Error(int exitCode, string code, string message)
    {
        Console.Error.WriteLine(JsonSerializer.Serialize(new { error = new { code, message } }));
        return exitCode;
    }
}