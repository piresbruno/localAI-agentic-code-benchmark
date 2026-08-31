# METRICS — deskboard / pi

**Run dir**: results/deskboard/GLM-5.3-Flash-EXL3-pi-20260831
**Started**: 2026-08-31 — time: `03:03` (scaffold commit f35ea12)
**Ended**: `04:21`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: deskboard
agent: pi
model: GLM-5.3-Flash-EXL3
wall_time: 01:18:00        # scaffold commit 03:03:15 → bookkeeping 04:21, excludes pre-run bootstrap
total_tokens: 15206298     # input + output, pi session log (last flushed message before bookkeeping)
input_tokens: 15086478
output_tokens: 119820
avg_tps: 30.6              # output_tokens ÷ wall_time (wall includes tool execution; generation-only tps not exposed)
cost: 0                    # provider reported zero cost (local inference)
verdict:                   # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                     # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: scaffold git-commit timestamp (03:03:15 local) → final bookkeeping commit (~04:21). The session began 02:02 with benchmark bootstrap (reading BENCHMARKS.md, scaffolding); that pre-run time is excluded from the per-project wall time.
- **avg_tps**: output tokens ÷ wall_time (noted; the harness does not expose generation-only time).
- Totals include retries/errors — 5 test-iteration failures fixed forward are part of the real cost.
- Source: pi session JSONL `~/.pi/agent/sessions/--home-piresbruno-developer-code-benchmark--/2026-08-31T02-02-01-904Z_*.jsonl`, summed per-message `usage.input` / `usage.output` over 144 assistant messages, up to the last flushed message before bookkeeping.

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 144 usage-bearing assistant messages |
| Errors/retries visible in transcript (build/test failures) | 5 (service-test expectations, React dedupe, SPA dot-dir send bug, mock-history leaks, unused import) — all fixed forward |
| Cache-read tokens (if reported) | 0 |
| Harness + version | pi coding agent (node 22.22.3), provider GLM-5.3-Flash-EXL3 |

## Where to find the numbers (by harness)

- **Pi**: session log under `~/.pi/agent/sessions/` — messages carry per-turn `usage`; jq/python sum over the file.

Paste the exact command used to extract:

```bash
python3 - <<'EOF'
import json
inp=out=0
for line in open(SESSION):
    e=json.loads(line); u=e.get('usage') or (e.get('message') or {}).get('usage')
    if u: inp+=u.get('input',0); out+=u.get('output',0)
print(inp, out)
EOF
```

## Raw transcript excerpt (evidence)

```
"usage":{"input":15086478,"output":119820 summed over 144 messages}
"usage":{"input":163465,"output":306,"cacheRead":0,"cacheWrite":0,"reasoning":0,"totalTokens":163771,"cost":{"input":0,"output":0,"cacheRead":0,"cacheWrite":0,"total":0}
```
