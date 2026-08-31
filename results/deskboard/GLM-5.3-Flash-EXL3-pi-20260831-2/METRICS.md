# METRICS — deskboard / pi

**Run dir**: results/deskboard/GLM-5.3-Flash-EXL3-pi-20260831-2
**Started**: 2026-08-31 — time: `12:35:36`
**Ended**: `13:42:30`

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: deskboard
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 01:06:54
total_tokens: 12,598,747
input_tokens: 12,479,622
output_tokens: 119,125
avg_tps: 31.9
cost: 0 (self-hosted EXL3 proxy reports zero cost)
verdict: # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score: # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: run start (PLAN.md written) → closing bookkeeping commit, from git commit timestamps (12:35:36 → 13:42:30 local).
- **avg_tps**: output tokens ÷ run wall-seconds (per-message generation time not exposed by the harness; simple wall-clock derivation, same basis as prior runs).
- **total_tokens**: summed per-message `message.usage` from the pi harness session JSONL (`~/.pi/agent/sessions/--home-piresbruno-developer-code-benchmark--/2026-08-31T11-19-06-828Z_*.jsonl`), bucketed to entries timestamped ≥ run start (12:35:36 local). Includes one ~11.9M-token input call (full context replay at run start).
- Include retries/errors in totals — they are part of the run's real cost.

## Extra observations

| Metric                                                     | Value |
| ---------------------------------------------------------- | ----- |
| Session/turn count                                         |       |
| Errors/retries visible in transcript (build/test failures) |       |
| Cache-read tokens (if reported)                            |       |
| Harness + version                                          |       |

## Where to find the numbers (by harness)

- **Claude Code**: `/cost` in-session; or parse the newest `~/.claude/projects/<run-dir-slug>/*.jsonl` — per-message `usage` fields (sum `input_tokens` + `output_tokens`; timestamps give wall time).
- **Pi**: session log under `~/.pi/agent/sessions/` (or `PI_*` env config) — messages carry token usage; `/stats` if available in-session.
- **Codex**: `~/.codex/sessions/<date>/` rollout JSONL — token usage per event; `/status` in-session.

Paste the exact command used to extract:

```bash
# e.g. jq over the session JSONL …
```

## Raw transcript excerpt (evidence)

```
(paste the final usage line / /cost output / status output here)
```
