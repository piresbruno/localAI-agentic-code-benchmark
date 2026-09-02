# METRICS — fastcrc / pi

**Run dir**: results/fastcrc/GLM-5.3-Flash-EXL3-pi-20260902-2
**Started**: 2026-09-02 — time: `15:26` (session init; scaffold committed 15:30:37)
**Ended**: 2026-09-02 — time: `16:04`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: fastcrc
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 00:37:41     # hh:mm:ss, total execution time
total_tokens: 5510720   # input + output
input_tokens: 5455993
output_tokens: 54727
avg_tps: 24.2           # output tokens / sec
cost: 0                 # local model (local-openai endpoint), no billed cost
verdict:                # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                  # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: first → last record timestamp in the run's session JSONL (2026-09-02T14:26:46Z → 15:04:27Z UTC = 15:26:46 → 16:04:27 local GMT+1) = 2261 s = 00:37:41. Includes ~4 min of pre-scaffold spec/skill reading; no operator idle exclusion applied (none observed).
- **avg_tps**: output tokens ÷ wall_time (generation time not exposed by harness). 54727 / 2261 = 24.2.
- Totals include all retries/errors: 3 compile errors (2× CS0246 missing `using System;` on stubs, 1× CS0103 missing `using System.Text;` in tests) and 1 coverage-gate miss (84.21% → closed with branch tests to 98.48%). All fixed forward; no test failures at final state.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 62 assistant messages carrying usage |
| Errors/retries visible in transcript (build/test failures) | 3 compile errors + 1 coverage-gate miss, all fixed forward (see derivation notes) |
| Cache-read tokens (if reported) | 0 (model reports no cache-read on this local EXL3 endpoint) |
| Harness + version | pi / Oh My Pi, model GLM-5.3-Flash-EXL3 via local-openai endpoint, SDK dotnet 10.0.302 |

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
session: ~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark/2026-09-02T14-26-46-362Z_01a06283-e5da-7564-baa8-147143bfe1bc.jsonl (picked by first_ts ≈ run start, not newest-by-mtime)
input_tokens: 5455993 output_tokens: 54727 total_tokens: 5510720
cache_read: 0 cache_write: 0 cost: 0.0
first_ts: 2026-09-02T14:26:46.362Z last_ts: 2026-09-02T15:04:27.768Z wall: 2261 s (00:37:41) avg_tps: 24.2
```
