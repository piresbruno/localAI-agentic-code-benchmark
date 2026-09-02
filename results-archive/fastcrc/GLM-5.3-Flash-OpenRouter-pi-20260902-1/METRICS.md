# METRICS — fastcrc / pi

**Run dir**: results/fastcrc/GLM-5.3-Flash-OpenRouter-pi-20260902-1
**Started**: 2026-09-02 — time: `13:18:46Z`
**Ended**: `13:48:57Z`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: fastcrc
agent: pi
model: GLM-5.3-Flash-OpenRouter
wall_time: 00:30:11
total_tokens: 1776461
input_tokens: 1712695
output_tokens: 63766
avg_tps: 35.2
cost: 0.101864
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
| Session/turn count | 1 session, 23 usage-bearing assistant messages |
| Errors/retries visible in transcript (build/test failures) | 3 fixed forward: new-run.sh BSD-sed placeholder failure (manual substitution); CS1010; CS0103 (JS template-escaping of C# literals) |
| Cache-read tokens (if reported) | 1,557,696 |
| Harness + version | Oh My Pi (pi), model glm-5.3-flash via OpenRouter; max concurrent subagents 0 (serial, micro-tier) |

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
session: ~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark/2026-09-02T13-18-46-570Z_01a06245-a52a-71b0-a886-56b24c7d2f11.jsonl
first_ts: 2026-09-02T13:18:46.570Z  last_ts: 2026-09-02T13:48:57.678Z
input_tokens (incl cacheRead): 1712695  output_tokens: 63766  total: 1776461
cacheRead: 1557696  cacheWrite: 0  cost: 0.101864
wall: 00:30:11 (1811s)  avg_tps (output/wall): 35.2
```
