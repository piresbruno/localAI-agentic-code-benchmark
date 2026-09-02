# METRICS — fastcrc / GLM-5.3-Flash-OpenRouter

**Run dir**: results/GLM-5.3-Flash-OpenRouter-pi-20260902-2
**Started**: 2026-09-02 — time: `14:58`
**Ended**: `15:11`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: fastcrc
agent: GLM-5.3-Flash-OpenRouter
model: GLM-5.3-Flash-OpenRouter
wall_time: 00:14:05
total_tokens: 2248459
input_tokens: 2212181
output_tokens: 36278
avg_tps: 42.9
cost: 0.139119
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
| Session/turn count | 32 assistant messages |
| Errors/retries visible in transcript (build/test failures) | 1 — stray token in CliTests.cs caught in review before first build; TDD red run by design; scaffold BSD-sed bug worked around |
| Cache-read tokens (if reported) | 1,757,056 |
| Harness + version | pi (Oh My Pi); GLM-5.3-Flash via OpenRouter |

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
print("input_tokens: 2212181", i, "output_tokens: 36278", o, "total_tokens:", i + o)
print("cache_read:", cr, "cache_write:", cw, "cost:", round(cost, 6))
PY
```

## Raw transcript excerpt (evidence)

```
session: ~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark/2026-09-02T13-57-41-663Z_01a06269-469f-7638-a3d3-0e53e02e5090.jsonl
messages with usage: 32 | first_ts: 2026-09-02T13:57:41.663Z last_ts: 2026-09-02T14:11:47.648Z
input_tokens: 2212181 output_tokens: 36278 total_tokens: 2248459
cache_read: 1757056 cache_write: 0 cost: 0.139119
wall seconds: 845 wall: 00:14:05 | avg tps (out/wall): 42.9
```
