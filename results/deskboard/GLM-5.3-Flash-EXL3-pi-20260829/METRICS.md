# METRICS — deskboard / pi

**Run dir**: results/deskboard/GLM-5.3-Flash-EXL3-pi-20260829
**Started**: 2026-08-29 — time: `01:56:56 UTC`
**Ended**: 2026-08-29 `02:47:57 UTC`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the global ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this)

```yaml
project: deskboard
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 00:51:01
total_tokens: 10264302
input_tokens: 10179452
output_tokens: 84850
avg_tps: 27.7
cost: 0
verdict:
score:
# normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: first → last timestamp in the pi session JSONL (2026-08-29T01:56:56Z → 02:47:57Z) = 00:51:01.
- **avg_tps**: output tokens ÷ wall_time (generation time not exposed by harness): 84,850 / 3061s ≈ 27.7 t/s. Source: pi session JSONL usage fields (`message.usage.input/output`, summed over 132 events).
- Include retries/errors in totals — they are part of the run's real cost.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 132 usage events (harness session JSONL) |
| Errors/retries visible in transcript (build/test failures) | ~10 (TS build errors, sync/async test mismatches, SPA path bug — all fixed forward) |
| Cache-read tokens (if reported) | |
| Harness + version | pi coding agent (PI_CODING_AGENT), provider GLM-5.3-Flash-EXL3 |

## Where to find the numbers (by harness)

- **Claude Code**: `/cost` in-session; or parse the newest `~/.claude/projects/<run-dir-slug>/*.jsonl` — per-message `usage` fields (sum `input_tokens` + `output_tokens`; timestamps give wall time).
- **Pi**: session log under `~/.pi/agent/sessions/` (or `PI_*` env config) — messages carry token usage; `/stats` if available in-session.
- **Codex**: `~/.codex/sessions/<date>/` rollout JSONL — token usage per event; `/status` in-session.

Paste the exact command used to extract:

```bash
node -e '...sum message.usage.input/output over ~/.pi/agent/sessions/.../2026-08-29T01-56-56-967Z_*.jsonl'
# -> {"inTok":10179452,"outTok":84850,"events":132}
```

## Raw transcript excerpt (evidence)

```
(paste the final usage line / /cost output / status output here)
```
