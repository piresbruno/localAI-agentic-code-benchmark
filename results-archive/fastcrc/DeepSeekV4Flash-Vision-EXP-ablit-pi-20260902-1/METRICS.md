# METRICS — fastcrc / pi

**Run dir**: results/fastcrc/DeepSeekV4Flash-Vision-EXP-ablit-pi-20260902-1
**Started**: 2026-09-02 — time: `03:26:26Z`
**Ended**: `03:48:01Z`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: fastcrc
agent: pi
model: DeepSeekV4Flash-Vision-EXP-ablit
wall_time: 00:21:35
total_tokens: 4004930
input_tokens: 3955962
output_tokens: 48968
avg_tps: 37.8
cost: 0.0376
verdict:                # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                  # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: harness session start (2026-09-02T03:26:26.000Z, first log record) → last message (03:48:01.458Z). No operator idle time occurred during the run; nothing excluded. (Re-extracted after closing commit; final report message itself is not yet in the log.)
- **avg_tps**: output tokens ÷ wall time = 48968 / 1295 s = 37.8. Per-call generation time is not exposed in the session log; wall-time-derived (noted per METRICS convention).
- **total_tokens** = sum of per-message `totalTokens` (input + cacheRead + output) from the omp session JSONL, retries included (there were none — all API calls succeeded).
- **input_tokens** = sum(input + cacheRead); cache-read tokens are listed separately below.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 44 assistant API calls (usage records); 2 user messages |
| Errors/retries visible in transcript (build/test failures) | 3 tool/command hiccups, all fixed forward: (1) `new-run.sh` sed failed on macOS (BSD sed) — placeholders filled manually; (2) SDK 10 created `.slnx` — regenerated classic `fastcrc.sln`; (3) two compile iterations: CS0103 (Program.cs missing `using`), CS0246 (test file missing `using Xunit`). 0 test failures, 0 retried API calls |
| Cache-read tokens (if reported) | 3,862,784 cacheRead (+ 0 cacheWrite) |
| Harness + version | Oh My Pi (pi) agent, model local-openai/deepseek-v4-flash-vision-exp |

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

Session file: `~/.omp/agent/sessions/-Developer-localAI-agentic-code-benchmark/2026-09-02T03-26-26-000Z_01a06027-56d0-728b-973b-43d458c3c48b.jsonl`

Extraction run output:

```
input: 3955962 output: 48968 total: 4004930
cacheRead: 3862784 cacheWrite: 0
cost: 0.037572363
assistant API calls(usage recs): 44 user messages: 2
first: 2026-09-02T03:26:26.000Z last: 2026-09-02T03:48:01.458Z
wallSec: 1295 => 00:21:35
avg_tps (out/wall): 37.81
```

Example per-message usage record (newest-style entry):

```json
{"input": 2414, "output": 412, "cacheRead": 38656, "cacheWrite": 0, "totalTokens": 41482, "cost": {"input": 0.00033796, "output": 0.00011536, "cacheRead": 0.0001082368, "cacheWrite": 0, "total": 0.0005615568}}
```
