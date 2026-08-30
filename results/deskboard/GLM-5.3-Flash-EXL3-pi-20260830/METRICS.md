# METRICS — deskboard / pi

**Run dir**: results/deskboard/GLM-5.3-Flash-EXL3-pi-20260830
**Started**: 2026-08-30 — time: `08:58:48Z` (session start; run began ~09:02Z)
**Ended**: `10:07:22Z`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the global ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this)

```yaml
project: deskboard
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 01:08:34     # session start 08:58:48Z -> 10:07:22Z (incl. ~4 min pre-run ping)
total_tokens: 164391    # final context totalTokens (in+out as reported per request)
input_tokens:           # not separately summable: provider reports cumulative per-request input
output_tokens: 110776   # cumulative sum of per-request output across 141 requests
avg_tps: 27.4           # output_tokens / wall_time (generation-time not exposed)
cost: 0                 # reported cost is 0 (local EXL3 inference)
verdict:                # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                  # normalized 0-100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: harness session start → last message. Exclude operator idle time if the harness allows; note how it was computed.
- **avg_tps**: output tokens ÷ generation time if exposed; otherwise output tokens ÷ wall_time (note which).
- Include retries/errors in totals — they are part of the run's real cost.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 141 model requests with usage |
| Errors/retries visible in transcript (build/test failures) | 1 npm ERESOLVE (react-hooks plugin peer) fixed by upgrading to v5; 2 rounds of failing client tests fixed forward; 0 restarts |
| Cache-read tokens (if reported) | 0 (local EXL3 inference) |
| Harness + version | pi coding agent, node v22.22.3 |

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
