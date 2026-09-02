# METRICS — huffcode / pi

**Run dir**: results/huffcode/DeepSeekV4Flash-Vision-EXP-ablit-pi-20260902-1
**Started**: 2026-09-02 — time: `02:23`
**Ended**: `03:16`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the `results/RESULTS.md` ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this for results/RESULTS.md)

```yaml
project: huffcode
agent: pi
model: DeepSeekV4Flash-Vision-EXP-ablit
wall_time: 00:53:00        # approx: scaffold 02:23 → close 03:16 (git commit timestamps; harness session start not observable)
total_tokens:              # harness did not expose usage this session (no ~/.pi session file for the benchmark dir today)
input_tokens:
output_tokens:
avg_tps:                # output tokens / sec
cost:
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
| Session/turn count | 19 (incl. 3 concurrent slice subagents) |
| Errors/retries visible in transcript (build/test failures) | 2 integration test failures on first full run (fixed before ship) |
| Parallel evidence | max_agents = 3 concurrent task subagents (S1Codec, S2Format, S3IoCli) — informational per BENCHMARKS.md |
| Cache-read tokens (if reported) | |
| Harness + version | |

## Where to find the numbers (by harness)

- **Claude Code**: `/cost` in-session; or parse the newest `~/.claude/projects/<run-dir-slug>/*.jsonl` — per-message `usage` fields (sum `input_tokens` + `output_tokens`; timestamps give wall time).
- **Pi**: session log under `~/.pi/agent/sessions/` (or `PI_*` env config) — messages carry token usage; `/stats` if available in-session.
- **Codex**: `~/.codex/sessions/<date>/` rollout JSONL — token usage per event; `/status` in-session.

Paste the exact command used to extract:

```bash
# Run AFTER the session closes: pi writes ~/.pi session logs at session end.
python3 - <<'EOF'
import json, glob, os
paths = sorted(glob.glob(os.path.expanduser(
    '~/.pi/agent/sessions/--home-piresbruno-developer-code-benchmark--/2026-09-02T*.jsonl')))
if not paths:
    print('no session log yet — terminate the session first'); raise SystemExit
f = paths[-1]
wins = {'logsluice': ('01:31', '02:21'), 'huffcode': ('02:23', '03:16'), 'fastcrc': ('03:25', '03:30')}
tot = {}
for line in open(f):
    try: ev = json.loads(line)
    except Exception: continue
    u = ev.get('usage') or {}; ts = ev.get('timestamp') or ''
    if not u or len(ts) < 11: continue
    for run, (a, b) in wins.items():
        if a <= ts[11:16] < b:
            c = tot.setdefault(run, {'in': 0, 'out': 0, 'total': 0})
            c['in'] += u.get('input', 0); c['out'] += u.get('output', 0)
            c['total'] += u.get('totalTokens', 0) + u.get('reasoning', 0)
for run, c in sorted(tot.items()):
    print(run, c, 'in+out=%d' % (c['in'] + c['out']))
EOF
```

## Raw transcript excerpt (evidence)

```
(paste the final usage line / /cost output / status output here)
```
