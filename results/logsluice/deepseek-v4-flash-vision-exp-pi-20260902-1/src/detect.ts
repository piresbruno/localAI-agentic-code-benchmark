import type { SourceFormat } from "./types.js";

/** §4.6 simplified syslog grammar — used for detection (any calendar is accepted). */
const SYSLOG_RE =
  /^([A-Z][a-z]{2}) +(\d{1,2}) (\d{2}):(\d{2}):(\d{2}) (\S+) ([^\[\s:]+)(?:\[\d+\])?: ([A-Za-z]+): ?(.*)$/;

function stripWrappingQuotes(cell: string): string {
  if (cell.length >= 2 && cell.startsWith('"') && cell.endsWith('"')) {
    return cell.slice(1, -1);
  }
  return cell;
}

export function detectFormat(firstNonBlankLine: string): SourceFormat | null {
  if (firstNonBlankLine.trimStart().startsWith("{")) return "jsonl";

  const firstCell = stripWrappingQuotes(firstNonBlankLine.split(",")[0]!.trim().toLowerCase());
  if (firstCell === "timestamp") return "csv";

  if (SYSLOG_RE.test(firstNonBlankLine)) return "syslog";

  return null;
}
