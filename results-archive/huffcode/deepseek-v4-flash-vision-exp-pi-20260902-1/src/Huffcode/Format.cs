using System.Text;
using System.Text.Json;

namespace Huffcode;

/// S2: .huf container serialize/parse. Pure BCL only.
public static class Format
{
    /// <summary>
    /// Serialize a header to a single line of compact JSON with the exact key
    /// order version, symbols, payloadLength, dataBits, pad and no trailing
    /// newline. Bit strings are MSB-first and emitted verbatim.
    /// </summary>
    public static string SerializeHeader(ContainerHeader header)
    {
        StringBuilder sb = new StringBuilder();
        sb.Append("{\"version\":").Append(header.Version);
        sb.Append(",\"symbols\":[");
        for (int i = 0; i < header.Symbols.Length; i++)
        {
            if (i > 0)
            {
                sb.Append(',');
            }

            CodeTableEntry entry = header.Symbols[i];
            sb.Append("{\"symbol\":").Append(entry.Symbol);
            sb.Append(",\"bits\":\"").Append(entry.Bits).Append("\"}");
        }

        sb.Append("],\"payloadLength\":").Append(header.PayloadLength);
        sb.Append(",\"dataBits\":").Append(header.DataBits);
        sb.Append(",\"pad\":").Append(header.Pad);
        sb.Append('}');
        return sb.ToString();
    }

    /// <summary>
    /// Parse a single header line into a <see cref="ContainerHeader"/>, or null
    /// on any structural failure: not JSON, wrong types, version != 1, missing
    /// or extra fields, unsorted/duplicate symbols, non-binary bits, multiple
    /// symbols with an empty code, non-prefix-free codes, negative DataBits,
    /// Pad outside 0-7, Pad inconsistent with DataBits, or negative
    /// PayloadLength. An empty code is permitted only for a single-symbol
    /// alphabet (R4).
    /// </summary>
    public static ContainerHeader? ParseHeader(string line)
    {
        JsonDocument doc;
        try
        {
            doc = JsonDocument.Parse(line);
        }
        catch (JsonException)
        {
            return null;
        }

        using (doc)
        {
            JsonElement root = doc.RootElement;
            if (root.ValueKind != JsonValueKind.Object)
            {
                return null;
            }

            HashSet<string> seen = new HashSet<string>(StringComparer.Ordinal);
            JsonElement version = default, symbols = default, payloadLength = default, dataBits = default, pad = default;
            foreach (JsonProperty prop in root.EnumerateObject())
            {
                if (!seen.Add(prop.Name))
                {
                    return null;
                }

                switch (prop.Name)
                {
                    case "version":
                        version = prop.Value;
                        break;
                    case "symbols":
                        symbols = prop.Value;
                        break;
                    case "payloadLength":
                        payloadLength = prop.Value;
                        break;
                    case "dataBits":
                        dataBits = prop.Value;
                        break;
                    case "pad":
                        pad = prop.Value;
                        break;
                    default:
                        return null;
                }
            }

            if (seen.Count != 5)
            {
                return null;
            }

            if (version.ValueKind != JsonValueKind.Number || !version.TryGetInt32(out int versionValue))
            {
                return null;
            }

            if (versionValue != 1)
            {
                return null;
            }

            if (dataBits.ValueKind != JsonValueKind.Number || !dataBits.TryGetInt32(out int dataBitsValue))
            {
                return null;
            }

            if (dataBitsValue < 0)
            {
                return null;
            }

            if (pad.ValueKind != JsonValueKind.Number || !pad.TryGetInt32(out int padValue))
            {
                return null;
            }

            if (padValue < 0 || padValue > 7)
            {
                return null;
            }

            if (padValue != (8 - (dataBitsValue % 8)) % 8)
            {
                return null;
            }

            if (payloadLength.ValueKind != JsonValueKind.Number || !payloadLength.TryGetInt32(out int payloadLengthValue))
            {
                return null;
            }

            if (payloadLengthValue < 0)
            {
                return null;
            }

            if (symbols.ValueKind != JsonValueKind.Array)
            {
                return null;
            }

            List<CodeTableEntry> entries = new List<CodeTableEntry>();
            foreach (JsonElement symEl in symbols.EnumerateArray())
            {
                if (symEl.ValueKind != JsonValueKind.Object)
                {
                    return null;
                }

                int symbolValue = 0;
                string bitsValue = string.Empty;
                bool gotSymbol = false, gotBits = false;
                HashSet<string> symSeen = new HashSet<string>(StringComparer.Ordinal);
                foreach (JsonProperty sp in symEl.EnumerateObject())
                {
                    if (!symSeen.Add(sp.Name))
                    {
                        return null;
                    }

                    if (sp.Name == "symbol")
                    {
                        if (!sp.Value.TryGetInt32(out int s))
                        {
                            return null;
                        }

                        symbolValue = s;
                        gotSymbol = true;
                    }
                    else if (sp.Name == "bits")
                    {
                        if (sp.Value.ValueKind != JsonValueKind.String)
                        {
                            return null;
                        }

                        bitsValue = sp.Value.GetString() ?? string.Empty;
                        gotBits = true;
                    }
                    else
                    {
                        return null;
                    }
                }

                if (symSeen.Count != 2 || !gotSymbol || !gotBits)
                {
                    return null;
                }

                entries.Add(new CodeTableEntry(symbolValue, bitsValue));
            }

            foreach (CodeTableEntry entry in entries)
            {
                foreach (char c in entry.Bits)
                {
                    if (c != '0' && c != '1')
                    {
                        return null;
                    }
                }

                if (entries.Count > 1 && entry.Bits.Length == 0)
                {
                    return null;
                }
            }

            for (int i = 1; i < entries.Count; i++)
            {
                if (entries[i].Symbol <= entries[i - 1].Symbol)
                {
                    return null;
                }
            }

            for (int i = 0; i < entries.Count; i++)
            {
                for (int j = 0; j < entries.Count; j++)
                {
                    if (i != j && entries[j].Bits.StartsWith(entries[i].Bits, StringComparison.Ordinal))
                    {
                        return null;
                    }
                }
            }

            return new ContainerHeader(versionValue, entries.ToArray(), payloadLengthValue, dataBitsValue, padValue);
        }
    }

    /// <summary>
    /// Render a full container: the serialized header line, a newline, then the
    /// lowercase hex payload. There is no trailing newline; when DataBits == 0
    /// the hex line is empty so the rendered text ends with the newline.
    /// </summary>
    public static string RenderContainer(Container container)
        => SerializeHeader(container.Header) + "\n" + container.DataHex;

    /// <summary>
    /// Parse a full container. Splits on the first '\n' (exactly one header line
    /// must exist), validates the header, then validates the hex payload: it must
    /// be lowercase, have an even length, have exactly ceil(DataBits/8) bytes, be
    /// empty only when DataBits == 0, and have the last <see cref="ContainerHeader.Pad"/>
    /// bits of the final byte be zero. Trailing characters or newlines after the
    /// hex are rejected. Returns null on any failure.
    /// </summary>
    public static Container? ParseContainer(string text)
    {
        int newline = text.IndexOf('\n');
        if (newline < 0)
        {
            return null;
        }

        string headerLine = text.Substring(0, newline);
        string rest = text.Substring(newline + 1);

        ContainerHeader? header = ParseHeader(headerLine);
        if (header is null)
        {
            return null;
        }

        if (rest.IndexOf('\n') >= 0)
        {
            return null;
        }

        foreach (char c in rest)
        {
            if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')))
            {
                return null;
            }
        }

        int byteCount = (header.DataBits + 7) / 8;
        if (rest.Length != byteCount * 2)
        {
            return null;
        }

        if (header.Pad > 0 && rest.Length >= 2)
        {
            int lastByte = HexNibble(rest[rest.Length - 2]) * 16 + HexNibble(rest[rest.Length - 1]);
            if ((lastByte & ((1 << header.Pad) - 1)) != 0)
            {
                return null;
            }
        }

        return new Container(header, rest);
    }

    private static int HexNibble(char c) => c <= '9' ? c - '0' : c - 'a' + 10;
}
