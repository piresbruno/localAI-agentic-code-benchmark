# METRICS — fastcrc / pi

**Run dir**: results/fastcrc/deepseek-v4-flash-0731-pi-20260902-1
**Started**: 2026-09-02 — time: `14:06:47`
**Ended**: `14:19:27`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: fastcrc
agent: pi
model: deepseek-v4-flash-0731
wall_time: 00:12:39
total_tokens: 5867526
input_tokens: 5798050
output_tokens: 69476
avg_tps: 91.4
cost: 0.117568
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
| Session/turn count | 229 JSONL rows (agent turns + tool calls) |
| Errors/retries visible in transcript (build/test failures) | 1 test-run fix round: golden-test arg bug + xunit culture-sensitive ANSI assertion (fixed forward); scaffold script BSD-sed incompatibility (worked around) |
| Cache-read tokens (if reported) | 5,495,552 |
| Harness + version | pi (omp) |

## Where to find the numbers (by harness)

- **Claude Code**: `/cost` in-session; or parse the newest `~/.claude/projects/<run-dir-slug>/*.jsonl` — per-message `usage` fields (sum `input_tokens` + `output_tokens`; timestamps give wall time).
- **Pi**: session log under `~/.omp/agent/sessions/<cwd-slug>/<session-id>.jsonl` (older installs: `~/.pi/agent/sessions/`) — assistant messages carry a `usage` object with `input`/`output`/`cacheRead`/`cacheWrite`/`totalTokens`/`cost`; session start/end timestamps give wall time. `/stats` may also work in-session.
- **Codex**: `~/.codex/sessions/<date>/` rollout JSONL — token usage per event; `/status` in-session.

Paste the exact command used to extract (Python, stdlib only — works without jq):

```bash
python3 - <<'PY'
import json, glob, os
# Newest session for the run's repo (cwd slug = repo path with non-alnum -> '-')
files = sorted(glob.glob(os.path.expanduser(
    "~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark/*.jsonl")),
    key=os.path.getmtime)
p = files[-1]
i = o = cr = cw = cost = 0.0
for line in open(p):
    e = json.loads(line)
    u = (e.get("message") or {}).get("usage") or e.get("usage")
    if u:
        i += u.get("input", 0) + u.get("cacheRead", 0)
        o += u.get("output", 0)
        cr += u.get("cacheRead", 0)
        cw += u.get("cacheWrite", 0)
        cost += (u.get("cost") or {}).get("total", 0)
print("session:", p)
print("input_tokens:", i, "output_tokens:", o, "total_tokens:", i + o)
print("cache_read:", cr, "cache_write:", cw, "cost:", round(cost, 6))
PY
```

## Raw transcript excerpt (evidence)

```
session: ~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark-wt/2026-09-02T14-06-47-286Z_01a06271-99f6-7015-a0f0-0e901910e509.jsonl
input_tokens: 5798050.0 (incl. cacheRead 5495552.0)  output_tokens: 69476.0  total_tokens: 5867526.0
cost: 0.117568   wall: 2026-09-02T14:06:47.286Z -> 14:19:27.141Z (00:12:39)
avg_tps: 91.4 (output / wall seconds)
```
