namespace Huffcode;

using System.Text;

/// S3b: argv parsing, error envelope, exit codes. The only Console user.
public static class Cli
{
    public static int RunCli(string[] args)
    {
        if (args.Length == 0)
            return Error("USAGE", "missing command");

        string cmd = args[0];
        if (cmd == "--help" || cmd == "-h")
        {
            Console.Out.Write(HelpText);
            return 0;
        }
        if (cmd == "--version" || cmd == "-v")
        {
            Console.Out.WriteLine("huffcode 1.0.0");
            return 0;
        }
        if (cmd != "encode" && cmd != "decode")
            return Error("USAGE", $"unknown command: {cmd}");

        string? inPath = null, outPath = null;
        for (int i = 1; i < args.Length; i++)
        {
            string flag = args[i];
            if (flag == "--in" || flag == "--out")
            {
                if (i + 1 >= args.Length)
                    return Error("USAGE", $"missing value for {flag}");
                string value = args[++i];
                if (flag == "--in") inPath = value;
                else outPath = value;
            }
            else
                return Error("USAGE", $"unknown flag: {flag}");
        }

        if (inPath == null) return Error("USAGE", "missing --in");
        if (outPath == null) return Error("USAGE", "missing --out");

        return cmd == "encode" ? Encode(inPath, outPath) : Decode(inPath, outPath);
    }

    private static int Encode(string inPath, string outPath)
    {
        byte[] input;
        try
        {
            input = Io.ReadAllBytes(inPath);
        }
        catch (FileNotFoundException)
        {
            return Error("INPUT_NOT_FOUND", $"input not found: {inPath}");
        }
        catch (DirectoryNotFoundException)
        {
            return Error("INPUT_NOT_FOUND", $"input not found: {inPath}");
        }

        var freqs = Codec.ByteFrequencies(input);
        var table = Codec.BuildCodeTable(freqs);
        var bits = Codec.EncodeBits(input, table);

        var symbols = table
            .OrderBy(kv => kv.Key)
            .Select(kv => new CodeTableEntry(kv.Key, kv.Value))
            .ToArray();

        int pad = bits.Length == 0 ? 0 : (8 - bits.Length % 8) % 8;
        var header = new ContainerHeader(1, symbols, input.Length, bits.Length, pad);
        var hex = BitsToHex(bits);
        var container = Format.RenderContainer(new Container(header, hex));

        Io.WriteAllBytes(outPath, Encoding.UTF8.GetBytes(container));
        return 0;
    }

    private static int Decode(string inPath, string outPath)
    {
        byte[] data;
        try
        {
            data = Io.ReadAllBytes(inPath);
        }
        catch (FileNotFoundException)
        {
            return Error("INPUT_NOT_FOUND", $"input not found: {inPath}");
        }
        catch (DirectoryNotFoundException)
        {
            return Error("INPUT_NOT_FOUND", $"input not found: {inPath}");
        }

        var text = Encoding.UTF8.GetString(data);
        var container = Format.ParseContainer(text);
        if (container == null)
            return Error("INVALID_HEADER", $"invalid header: {inPath}");

        var bits = HexToBits(container.DataHex);
        if (container.Header.Pad > 0)
            bits = bits.Substring(0, bits.Length - container.Header.Pad);

        var table = container.Header.Symbols.ToDictionary(e => (byte)e.Symbol, e => e.Bits);
        byte[] decoded;
        var headerSymbols = container.Header.Symbols;
        if (headerSymbols.Length == 1 && headerSymbols[0].Bits.Length == 0)
        {
            // R4: single-symbol alphabet — the code is empty; payloadLength copies must be restored.
            decoded = new byte[container.Header.PayloadLength];
            Array.Fill(decoded, (byte)headerSymbols[0].Symbol);
        }
        else
        {
            try
            {
                decoded = Codec.DecodeBits(bits, table);
            }
            catch (InvalidOperationException)
            {
                return Error("INVALID_HEADER", $"invalid header: {inPath}");
            }
        }

        if (decoded.Length != container.Header.PayloadLength)
            return Error("INVALID_HEADER", $"invalid header: {inPath}");

        Io.WriteAllBytes(outPath, decoded);
        return 0;
    }

    private static int Error(string code, string message)
    {
        Console.Error.WriteLine($"{{\"error\":{{\"code\":\"{code}\",\"message\":\"{message}\"}}}}");
        return code == "USAGE" ? 2 : 1;
    }

    private static string BitsToHex(string bits)
    {
        if (bits.Length == 0)
            return string.Empty;

        int pad = bits.Length % 8 == 0 ? 0 : 8 - bits.Length % 8;
        var bytes = new byte[(bits.Length + pad) / 8];
        for (int i = 0; i < bits.Length; i++)
            if (bits[i] == '1')
                bytes[i / 8] |= (byte)(1 << (7 - i % 8));

        return Convert.ToHexString(bytes).ToLowerInvariant();
    }

    private static string HexToBits(string hex)
    {
        var sb = new StringBuilder(hex.Length * 4);
        foreach (char ch in hex)
        {
            int v = ch switch
            {
                >= '0' and <= '9' => ch - '0',
                >= 'a' and <= 'f' => ch - 'a' + 10,
                _ => 0
            };
            for (int b = 3; b >= 0; b--)
                sb.Append((v >> b) & 1);
        }
        return sb.ToString();
    }

    private const string HelpText =
        "Usage: huffcode <command> [options]\n" +
        "\n" +
        "Commands:\n" +
        "  encode   Compress a raw input file into a .huf container\n" +
        "  decode   Decompress a .huf container back to the raw bytes\n" +
        "  --help, -h     Show this help message\n" +
        "  --version, -v  Show the version\n" +
        "\n" +
        "Options:\n" +
        "  --in <file>    Input file. encode reads raw bytes; decode reads a .huf container\n" +
        "  --out <file>   Output file. encode writes a .huf container; decode writes raw bytes\n" +
        "\n" +
        "Examples:\n" +
        "  huffcode encode --in sample/message.txt --out out.huf\n" +
        "  huffcode decode --in out.huf --out out.txt\n" +
        "\n" +
        "Exit codes:\n" +
        "  0    Success\n" +
        "  1    Data error (INPUT_NOT_FOUND: input file not found; INVALID_HEADER: malformed container or header)\n" +
        "  2    Usage error (USAGE: missing or unknown command, flag, or required option)\n" +
        "\n" +
        "Errors are reported as a single-line JSON envelope on stderr:\n" +
        "  {\"error\":{\"code\":\"USAGE\",\"message\":\"unknown command: foo\"}}\n" +
        "\n" +
        "Container format (.huf):\n" +
        "  Line 1: a JSON header with fields version, symbols[{symbol,bits}], payloadLength, dataBits, pad\n" +
        "  Line 2: the lowercase hex bitstream (MSB-first, zero-padded), with no trailing newline\n" +
        "\n" +
        "Determinism:\n" +
        "  Same input always produces byte-identical output. Code bits are built by repeatedly merging\n" +
        "  the two lowest-priority nodes (smallest (frequency, symbol) first), the first-popped node\n" +
        "  assigned 0 (left child); equal frequencies merge the smallest symbols first.\n";
}
