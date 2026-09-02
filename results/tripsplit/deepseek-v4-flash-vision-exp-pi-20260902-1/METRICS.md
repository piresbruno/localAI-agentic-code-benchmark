# METRICS — tripsplit / pi

**Run dir**: results/tripsplit/deepseek-v4-flash-vision-exp-pi-20260902-1
**Started**: 2026-09-02 — time: `00:56:48 +01:00` (2026-09-01T22:56:48Z, session start)
**Ended**: `01:00:00 +01:00` (2026-09-01T23:59:46Z at last measurement; closing commit within ~1 min)

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: tripsplit
agent: pi
model: deepseek-v4-flash-vision-exp
wall_time: 01:04:00          # hh:mm:ss, session start -> now (self-measured)
total_tokens: 9514851        # input + output + cache-read (self-reported telemetry)
input_tokens: 283622
output_tokens: 168829
avg_tps: 44.7                # output tokens / wall_time
cost: 0.1124                 # USD, from usage cost fields
verdict:                     # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                       # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: session start (2026-09-01T22:56:48Z from omp session file) → 2026-09-01T23:59:46Z; includes subagent time. Self-measured from session log/file timestamps.
- **avg_tps**: output tokens (168,829) ÷ wall time (3,779 s) = 44.7. Not generation-time-exposed; noted.
- Token/cost sums come from `usage` fields on assistant messages in the omp session jsonl (main session + CoreImpl + CliImpl subagent logs): 131 messages with usage. Includes subagent usage — part of the run's real cost.
- Errors/retries: 0 build/test errors; one automated smoke wrapper failed because `xxd` is not installed in this environment (tooling, not code) — reran with built-in `cmp`, all green.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 131 assistant messages w/ usage (main + 2 subagents) |
| Errors/retries visible in transcript | 1 (missing xxd in smoke wrapper); 0 code/test failures |
| Cache-read tokens (if reported) | 9,062,400 |
| Harness + version | omp (Oh My Pi), session dir ~/.omp/agent/sessions/ |

## Where to find the numbers (by harness)

- **Claude Code**: `/cost` in-session; or parse the newest `~/.claude/projects/<run-dir-slug>/*.jsonl` — per-message `usage` fields (sum `input_tokens` + `output_tokens`; timestamps give wall time).
- **Pi**: session log under `~/.pi/agent/sessions/` (or `PI_*` env config) — messages carry token usage; `/stats` if available in-session.
- **Codex**: `~/.codex/sessions/<date>/` rollout JSONL — token usage per event; `/status` in-session.

Paste the exact command used to extract:

```bash
# omp session jsonl usage fields summed with python (jsonl under
# ~/.omp/agent/sessions/-developer-code-benchmark/2026-09-01T22-56-48-908Z_01a05f30-7f0c-76ce-b08a-99f9ffdeff39.jsonl
# plus ./CoreImpl.jsonl and ./CliImpl.jsonl in the same directory)
```

## Raw transcript excerpt (evidence)

```
{"type":"message", ... "usage":{"input":283622,"output":168829,"cacheRead":9062400,"totalTokens":9514851}}
(main + subagent sums; cost total ≈ $0.1124)
```
