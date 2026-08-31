# METRICS — parkwise / pi

**Run dir**: results/parkwise/GLM-5.3-Flash-EXL3-pi-20260831
**Started**: 2026-08-31 — time: `04:22` (scaffold commit 8f91bc5)
**Ended**: `05:32`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: parkwise
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 01:09:56        # scaffold 04:22:20 → bookkeeping 05:32:16
total_tokens: 26883283     # input + output; session-log delta between the deskboard closing snapshot and this closing (pi session JSONL)
input_tokens: 26798220
output_tokens: 85063
avg_tps: 20.3              # output_tokens ÷ wall_time (wall includes tool execution; generation-only tps not exposed)
cost: 0                    # provider reported zero cost (local inference)
verdict:                   # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                     # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: harness session start → last message. Exclude operator idle time if the harness allows; note how it was computed.
- **avg_tps**: output tokens ÷ generation time if exposed; otherwise output tokens ÷ wall_time (note which).
- Include retries/errors in totals — they are part of the run's real cost.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | shared session with the deskboard run; parkwise portion ≈ half the transcript |
| Errors/retries visible in transcript (build/test failures) | 7 (4 test expectation/logic fixes, config override not applying, enum deserialization, launchSettings BOM) — all fixed forward |
| Cache-read tokens (if reported) | 0 |
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
