# METRICS — fastcrc / pi

**Run dir**: results/fastcrc/GLM-5.3-Flash-EXL3-pi-20260902-1
**Started**: 2026-09-02 — time: `12:59:59` (local GMT+1; 11:59:59Z)
**Ended**: `13:28:02` (local GMT+1; 12:28:02Z)

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: fastcrc
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 00:28:02
total_tokens: 2529484
input_tokens: 2489961
output_tokens: 39523
avg_tps: 23.5
cost: 0.0
verdict:                # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                  # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: harness session start → last message. Exclude operator idle time if the harness allows; note how it was computed.
  Here: newest `~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark/*.jsonl` first→last event timestamp (11:59:59Z → 12:28:02Z). No operator idle detected.
- **avg_tps**: output tokens ÷ generation time if exposed; otherwise output tokens ÷ wall_time (note which).
  Here: 39,523 ÷ 1682 s = 23.5 (generation time not exposed by the harness; wall used).
- Include retries/errors in totals — they are part of the run's real cost.
- `input_tokens` includes `cacheRead` per the extraction script convention; this model/harness reports **0** cache-read tokens. `total_tokens` = input + output (2,489,961 + 39,523).

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 1 session, 36 assistant messages |
| Errors/retries visible in transcript (build/test failures) | 2 — (1) `scripts/new-run.sh` BSD-sed placeholder failure → placeholders filled manually; (1) edit-tool misfire on `src/Fastcrc/Cli.cs` (inserted block inside raw string) → file rewritten cleanly. Zero build/test failures; 8/8 tests green on every run |
| Cache-read tokens (if reported) | 0 (model/harness reports none) |
| Harness + version | Oh My Pi (pi); model GLM-5.3-Flash-EXL3 via local-openai; harness version not exposed in telemetry |

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
first = last = None
for line in open(p):
    e = json.loads(line)
    ts = e.get("timestamp") or (e.get("message") or {}).get("timestamp")
    if ts:
        first = first or ts
        last = ts
    u = (e.get("message") or {}).get("usage") or e.get("usage")
    if u:
        i += u.get("input", 0) + u.get("cacheRead", 0)
        o += u.get("output", 0)
        cr += u.get("cacheRead", 0)
        cw += u.get("cacheWrite", 0)
        cost += (u.get("cost") or {}).get("total", 0)
print("session:", p)
print("started:", first, "ended:", last)
print("input_tokens:", i, "output_tokens:", o, "total_tokens:", i + o)
print("cache_read:", cr, "cache_write:", cw, "cost:", round(cost, 6))
PY
```

## Raw transcript excerpt (evidence)

```
session: .../2026-09-02T11-59-59-387Z_01a061fd-839b-73fa-a328-70e4973bcd6a.jsonl
started: 2026-09-02T11:59:59.387Z  ended: 2026-09-02T12:28:01.975Z
input_tokens: 2489961  output_tokens: 39523  total_tokens: 2529484
cache_read: 0  cache_write: 0  cost: 0.0
assistant messages: 36; wall = 00:28:02; avg tps = 23.5 (output ÷ wall)
```
