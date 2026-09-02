# METRICS — fastcrc / pi

**Run dir**: results/fastcrc/DeepSeekV4Flash-Vision-EXP-pi-20260902-1
**Started**: 2026-09-02 — time: `14:58:23`
**Ended**: 2026-09-02 — time: `15:04:17`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: fastcrc
agent: pi
model: DeepSeekV4Flash-Vision-EXP
wall_time: 00:05:54
total_tokens: 3888074
input_tokens: 3837102
output_tokens: 50972
avg_tps: 143.66
cost: 0.084484
verdict:                # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                  # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: harness session start → last message. Exclude operator idle time if the harness allows; note how it was computed.
- **avg_tps**: output tokens ÷ wall_time (00:05:54 = 354.81 s → 50,972 / 354.81 ≈ 143.66). The Pi harness exposes no per-message generation time, so wall_time is the denominator.
- Include retries/errors in totals — they are part of the run's real cost.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 104 messages |
| Errors/retries visible in transcript (build/test failures) | 0 |
| Cache-read tokens (if reported) | 3,724,509 |
| Harness + version | pi (Oh My Pi) |

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
session: ~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark-wt/2026-09-02T13-58-23-028Z_01a06269-e834-7101-98b9-931b53aa6bdb.jsonl
input_tokens: 3837102  output_tokens: 50972  total_tokens: 3888074
cache_read: 3724509  cache_write: 0  cost: 0.084484
wall: 00:05:54 (session start 13:58:23Z -> last message at time of capture; session still live)
```
