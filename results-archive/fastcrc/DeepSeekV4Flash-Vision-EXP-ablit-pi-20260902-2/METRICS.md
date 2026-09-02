# METRICS — fastcrc / pi

**Run dir**: results/fastcrc/DeepSeekV4Flash-Vision-EXP-ablit-pi-20260902-2
**Started**: 2026-09-02 — time: `06:22:43Z` (07:22:43 +01:00)
**Ended**: `~06:42:41Z`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: fastcrc
agent: pi
model: DeepSeekV4Flash-Vision-EXP-ablit
wall_time: 00:19:58              # hh:mm:ss, total execution time
total_tokens: 4220603           # input + output
input_tokens: 4173822
output_tokens: 46781
avg_tps: 39.03                # output tokens / sec
cost: 0.041012
verdict:                # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                  # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: harness session start (2026-09-02T06:22:43.566Z, `type: session` record) → last telemetry message (≈06:42:41Z). Includes operator scaffold/archive steps and agent implementation; excludes no idle time (not exposed).
- **avg_tps**: output tokens ÷ wall time (generation time not exposed by harness; same convention as prior runs).
- Include retries/errors in totals — they are part of the run's real cost.
- Cache-read tokens dominate input (4,055,552 of 4,173,822) — prompt-caching between the scaffold/implementation turns.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 219 records / 131 assistant messages |
| Errors/retries visible in transcript (build/test failures) | 3: CS0103 `Cli` not found (Program.cs namespaced fix); xUnit2013 analyzer (Assert.Single); 1 malformed edit-tool call corrupting CliTests.cs (rewritten line) |
| Cache-read tokens (if reported) | 4,055,552 input + 0 cache-write |
| Harness + version | omp (pi), local-openai/deepseek-v4-flash-vision-exp |

## Where to find the numbers (by harness)

- **Pi**: session log under `~/.omp/agent/sessions/<cwd-slug>/<session-id>.jsonl` — assistant messages carry a `usage` object with `input`/`output`/`cacheRead`/`cacheWrite`/`totalTokens`/`cost`; session start/end timestamps give wall time.

Paste the exact command used to extract (Python, stdlib only — works without jq):

```bash
python3 - <<'PY'
import json, glob, os
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

Result (2026-09-02, run DeepSeekV4Flash-Vision-EXP-ablit-pi-20260902-2):
- session: .../2026-09-02T06-22-43-566Z_01a060c8-....jsonl
- input_tokens: 4173822, output_tokens: 46781, total_tokens: 4220603
- cache_read: 4055552, cache_write: 0, cost: 0.041012
- wall_time: 00:19:58 (session record timestamp → last message)

## Raw transcript excerpt (evidence)

```
{"type":"session","timestamp":"2026-09-02T06:22:43.566Z","cwd":"/Users/brunopires/Developer/localAI-agentic-code-benchmark","title":"Run fastrc again"}
... last message: usage input + cacheRead=4173822, output=46781, cost.total=0.041012 ...
```
