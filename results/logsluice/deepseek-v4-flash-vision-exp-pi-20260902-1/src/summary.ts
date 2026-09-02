import type { Level, LogEvent, Summary } from "./types.js";

function compareStrings(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function summarize(
  events: LogEvent[],
  quarantined: number,
  opts: { dedup: boolean; top: number; percentiles: Array<"p50" | "p95"> },
): Summary {
  const totalEvents = events.length;

  // R6: key = canonical timestamp + service + message; first occurrence in processing order kept.
  let retained = events;
  let deduped = 0;
  if (opts.dedup) {
    const seen = new Set<string>();
    retained = [];
    for (const e of events) {
      const key = `${e.timestamp}\u0000${e.service}\u0000${e.message}`;
      if (seen.has(key)) {
        deduped++;
        continue;
      }
      seen.add(key);
      retained.push(e);
    }
  }

  const byLevel: Record<Level, number> = { trace: 0, debug: 0, info: 0, warn: 0, error: 0, fatal: 0 };
  const serviceCounts = new Map<string, number>();
  for (const e of retained) {
    byLevel[e.level]++;
    serviceCounts.set(e.service, (serviceCounts.get(e.service) ?? 0) + 1);
  }
  const byService = [...serviceCounts.entries()]
    .map(([service, count]) => ({ service, count }))
    .sort((a, b) => b.count - a.count || compareStrings(a.service, b.service));

  const offenderCounts = new Map<string, number>();
  for (const e of retained) {
    if (e.level === "error" || e.level === "fatal") {
      offenderCounts.set(e.service, (offenderCounts.get(e.service) ?? 0) + 1);
    }
  }
  const topOffenders = [...offenderCounts.entries()]
    .map(([service, errors]) => ({ service, errors }))
    .sort((a, b) => b.errors - a.errors || compareStrings(a.service, b.service))
    .slice(0, opts.top);

  const durations = retained
    .map((e) => e.durationMs)
    .filter((d): d is number => d !== null)
    .sort((a, b) => a - b);
  const percentile = (p: number): number | null => {
    if (durations.length === 0) return null;
    const rank = Math.ceil((p / 100) * durations.length);
    return durations[rank - 1]!;
  };
  const percentileOpts = opts.percentiles;
  const percentiles = {
    p50: percentileOpts.includes("p50") ? percentile(50) : null,
    p95: percentileOpts.includes("p95") ? percentile(95) : null,
  };

  return { totalEvents, quarantined, deduped, byLevel, byService, topOffenders, percentiles };
}
