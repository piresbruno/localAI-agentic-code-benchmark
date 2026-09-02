namespace Huffcode;

/// One symbol's binary code; bits are MSB-first, e.g. "0101".
public sealed record CodeTableEntry(int Symbol, string Bits);

/// .huf container header (first line of the container file).
public sealed record ContainerHeader(
    int Version,
    CodeTableEntry[] Symbols,  // sorted by Symbol ascending
    int PayloadLength,         // decoded byte count
    int DataBits,              // number of bits in the bitstream (payload, before padding)
    int Pad                    // padding bits appended to fill the final byte (0-7)
);

public sealed record Container(ContainerHeader Header, string DataHex);
