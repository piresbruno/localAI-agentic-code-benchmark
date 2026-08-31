# METRICS — deskboard / pi

**Run dir**: results/deskboard/GLM-5.3-Flash-EXL3-pi-20260831-3
**Started**: 2026-08-31 — time: `____:____`
**Ended**: `____:____`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: deskboard
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time:              # hh:mm:ss, total execution time
total_tokens:           # input + output
input_tokens:
output_tokens:
avg_tps:                # output tokens / sec
cost:
verdict:                # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                  # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: harness session start → last message. Exclude operator idle time if the harness allows; note how it was computed.
- **avg_tps**: output tokens ÷ generation time if exposed; otherwise output tokens ÷ wall_time (note which).
- Include retries/errors in totals — they are part of the run's real cost.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | |
| Errors/retries visible in transcript (build/test failures) | |
| Cache-read tokens (if reported) | |
| Harness + version | |

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
