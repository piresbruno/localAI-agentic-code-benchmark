/** One symbol's binary code; bits are MSB-first, e.g. "0101". */
export interface CodeTableEntry {
  symbol: number;  // byte value 0–255
  bits: string;    // '0'/'1' string; "" only for a single-symbol alphabet
}

/** .huf container header (first line of the container file). */
export interface ContainerHeader {
  version: 1;
  symbols: CodeTableEntry[];  // sorted by symbol ascending
  payloadLength: number;      // decoded byte count
  dataBits: number;           // number of bits in the bitstream (payload, before padding)
  pad: number;                // padding bits appended to fill the final byte (0–7)
}

export interface Container {
  header: ContainerHeader;
  dataHex: string; // lowercase hex of the padded bitstream; "" when dataBits === 0
}
