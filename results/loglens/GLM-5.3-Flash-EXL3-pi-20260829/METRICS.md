# METRICS — loglens / pi

**Run dir**: results/loglens/GLM-5.3-Flash-EXL3-pi-20260829
**Started**: 2026-08-29 — time: `02:48:38 UTC`
**Ended**: 2026-08-29 `03:39:41 UTC`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the global ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this)

```yaml
project: loglens
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 00:51:03
total_tokens: 22863549
input_tokens: 22781843
output_tokens: 81706
avg_tps: 26.7
cost: 0
verdict:
score:# normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: harness session start → last message. Exclude operator idle time if the harness allows; note how it was computed.
- **avg_tps**: output tokens ÷ wall_time (generation time not exposed): 81,706 / 3063s ≈ 26.7 t/s. Source: pi session JSONL `message.usage` fields.
- Include retries/errors in totals — they are part of the run's real cost.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 127 usage events in this run (harness session JSONL, shared session with deskboard run; per-run split at 02:48 UTC) |
| Errors/retries visible in transcript (build/test failures) | ~12 (circular import, parser redesign, ruff findings) — all fixed forward |
| Cache-read tokens (if reported) | |
| Harness + version | pi coding agent (PI_CODING_AGENT), provider GLM-5.3-Flash-EXL3 |

## Where to find the numbers (by harness)

- **Claude Code**: `/cost` in-session; or parse the newest `~/.claude/projects/<run-dir-slug>/*.jsonl` — per-message `usage` fields (sum `input_tokens` + `output_tokens`; timestamps give wall time).
- **Pi**: session log under `~/.pi/agent/sessions/` (or `PI_*` env config) — messages carry token usage; `/stats` if available in-session.
- **Codex**: `~/.codex/sessions/<date>/` rollout JSONL — token usage per event; `/status` in-session.

Paste the exact command used to extract:

```bash
node -e '...sum message.usage.input/output over ~/.pi/agent/sessions/.../2026-08-29T01-56-56-967Z_*.jsonl with timestamp >= 2026-08-29T02:48:00'
# -> {"inTok":22781843,"outTok":81706,"events":127}
```

## Raw transcript excerpt (evidence)

```
(paste the final usage line / /cost output / status output here)
```
