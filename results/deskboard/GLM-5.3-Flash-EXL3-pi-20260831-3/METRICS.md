# METRICS — deskboard / pi

**Run dir**: results/deskboard/GLM-5.3-Flash-EXL3-pi-20260831-3
**Started**: 2026-08-31 — time: `12:46:29`
**Ended**: `14:17:04`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: deskboard
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 01:30:35
total_tokens: 21231973
input_tokens: 21094622
output_tokens: 137351
avg_tps: 25.3
cost: 0
verdict:
score:
```

## Derivation notes

- **wall_time**: harness session start → last message. Exclude operator idle time if the harness allows; note how it was computed.
- **avg_tps**: output tokens ÷ generation time if exposed; otherwise output tokens ÷ wall_time (note which).
- Include retries/errors in totals — they are part of the run's real cost.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 185 usage events in session JSONL |
| Errors/retries visible in transcript (build/test failures) | ~12 fixed-forward rounds (see PLAN.md final report) |
| Cache-read tokens (if reported) | 0 (not reported) |
| Harness + version | pi coding agent, Node 22.22.3, model GLM-5.3-Flash-EXL3 |

## Where the numbers came from

```bash
SESSION=~/.pi/agent/sessions/--home-piresbruno-developer-code-benchmark--/2026-08-31T12-46-29-200Z_01a057db-5d50-7428-b81f-e943ec47a9b3.jsonl
jq -s 'map(select(.message.usage)) | map(.message.usage) | {events: length, input: (map(.input) | add), output: (map(.output) | add)}' "$SESSION"
head -1 "$SESSION" | jq -r .timestamp; tail -1 "$SESSION" | jq -r .timestamp
```

- **wall_time**: first → last session-JSONL timestamp (12:46:29 → 14:17:04, UTC+1). Includes the operator-attended scaffold kickoff.
- **avg_tps**: output_tokens ÷ wall_time (per-message generation latency not exposed by this harness).

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
