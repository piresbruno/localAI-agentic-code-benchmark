import type { Summary } from "./types.js";

const LEVELS = ["trace", "debug", "info", "warn", "error", "fatal"] as const;

export function renderTable(s: Summary): string {
  const lines: string[] = [];
  lines.push(`events  ${s.totalEvents}`);
  lines.push(`quarantined  ${s.quarantined}`);
  lines.push(`deduped  ${s.deduped}`);
  lines.push("");
  lines.push("by level");
  for (const lv of LEVELS) lines.push(`${lv}  ${s.byLevel[lv]}`);
  lines.push("");
  lines.push("by service");
  for (const row of s.byService) lines.push(`${row.service}  ${row.count}`);
  lines.push("");
  lines.push("top offenders (error+fatal)");
  for (const row of s.topOffenders) lines.push(`${row.service}  ${row.errors}`);
  lines.push("");
  lines.push("latency (ms)");
  lines.push(`p50  ${s.percentiles.p50 ?? "-"}`);
  lines.push(`p95  ${s.percentiles.p95 ?? "-"}`);
  return lines.join("\n") + "\n";
}

export function renderJson(s: Summary): string {
  return JSON.stringify(s, null, 2) + "\n";
}
