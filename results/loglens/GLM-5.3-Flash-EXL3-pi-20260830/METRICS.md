# METRICS — loglens / pi

**Run dir**: results/loglens/GLM-5.3-Flash-EXL3-pi-20260830
**Started**: 2026-08-30 — time: `12:39:24` (project work start; session opened 12:22)
**Ended**: `14:01:30`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the global ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this)

```yaml
project: loglens
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 01:22:06
total_tokens: 21459134
input_tokens: 21311285
output_tokens: 147849
avg_tps: 30.0
cost:
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
| Session/turn count | 175 usage entries in session jsonl |
| Errors/retries visible in transcript (build/test failures) | ~21 fix-forward cycles, 0 restarts (detail in PLAN.md) |
| Cache-read tokens (if reported) | 0 (local EXL3 serving; per-message input includes re-sent context) |
| Harness + version | pi coding agent (GLM-5.3-Flash-EXL3 via local provider) |

## Where to find the numbers (by harness)

- **Claude Code**: `/cost` in-session; or parse the newest `~/.claude/projects/<run-dir-slug>/*.jsonl` — per-message `usage` fields (sum `input_tokens` + `output_tokens`; timestamps give wall time).
- **Pi**: session log under `~/.pi/agent/sessions/` (or `PI_*` env config) — messages carry token usage; `/stats` if available in-session.
- **Codex**: `~/.codex/sessions/<date>/` rollout JSONL — token usage per event; `/status` in-session.

Paste the exact command used to extract:

```bash
python3 - <<'PYEOF'
import json
path = "/home/piresbruno/.pi/agent/sessions/--home-piresbruno-developer-code-benchmark--/2026-08-30T12-21-38-525Z_01a0529e-425d-7728-97e0-b94c8b19a394.jsonl"
ti = to = 0
for line in open(path):
    u = (json.loads(line).get("message") or {}).get("usage") or {}
    ti += u.get('input', 0); to += u.get('output', 0)
print(ti, to)
PYEOF
# wall_time: first/last timestamped session entry vs. project work start (12:39:24Z)
```

## Raw transcript excerpt (evidence)

```
message.usage = {'input': 19440, 'output': 79, 'cacheRead': 0, 'cacheWrite': 0,
                 'reasoning': 0, 'totalTokens': 19519, 'cost': {...}}
first entry: 2026-08-30T12:22:18.185Z   last entry: 2026-08-30T14:00:24.220Z
sum over 175 usage entries: input 21,311,285 / output 147,849 / total 21,459,134
avg_tps = 147,849 / 4,926 s (14:01 minus 12:39) = ~30.0 output tokens/s (wall-clock estimate)
```
