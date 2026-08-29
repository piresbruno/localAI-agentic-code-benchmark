# METRICS — deskboard / pi

**Run dir**: results/deskboard/deepseek-v4-flash-pi-20260829
**Started**: 2026-08-29 — time: `____:____`
**Ended**: `____:____`

> Fill this from **harness telemetry** (session logs below), NOT from the agent's own report. The agent's self-report goes in PLAN.md; if the two disagree, the harness numbers win. After grading, copy `verdict` and `score` from RESULT.md into the yaml block — `build-report.py` reads it for the global ranking.

## Machine-readable block (fill exactly — scripts/build-report.py parses this)

```yaml
project: deskboard
agent: pi
model: deepseek-v4-flash
wall_time: 01:11:48
total_tokens: 26508376
input_tokens: 26323203
output_tokens: 185173
avg_tps: 43.0
cost:
verdict:                # PASS | PASS-WITH-NOTES | FAIL  (from RESULT.md)
score:                  # normalized 0–100 (from RESULT.md)
```

## Derivation notes

- **wall_time**: 2026-08-29 20:45:54Z → 22:57:42Z per pi session log (first → last message); 4308s = 01:11:48.
- **avg_tps**: 43.0 = output tokens ÷ wall seconds (harness does not expose separate generation time).
- **tokens**: summed `message.usage.{input,output}` across 179 assistant messages in the pi session JSONL (`~/.pi/agent/sessions/.../2026-08-29T20-45-54-734Z_*.jsonl`).

## Extra observations

| Metric | Value |
|--------|-------|
| Session/turn count | 179 assistant messages |
| Errors/retries visible in transcript (build/test failures) | ~18 TS errors + ~38 failing-test iterations, all resolved |
| Cache-read tokens (if reported) | not reported |
| Harness + version | pi (PI_CODING_AGENT=true), model deepseek-ai/DeepSeek-V4-Flash-0731 |

## Where to find the numbers (by harness)

- **Claude Code**: `/cost` in-session; or parse the newest `~/.claude/projects/<run-dir-slug>/*.jsonl` — per-message `usage` fields (sum `input_tokens` + `output_tokens`; timestamps give wall time).
- **Pi**: session log under `~/.pi/agent/sessions/` (or `PI_*` env config) — messages carry token usage; `/stats` if available in-session.
- **Codex**: `~/.codex/sessions/<date>/` rollout JSONL — token usage per event; `/status` in-session.

Paste the exact command used to extract:

```bash
python3 - <<'EOF'
import json, datetime
p = '~/.pi/agent/sessions/--home-piresbruno-developer-code-benchmark--/2026-08-29T20-45-54-734Z_01a04f45-92ae-719d-b710-ed4f2e70c193.jsonl'
in_tok=out_tok=0; first=last=None
for line in open(p):
    o=json.loads(line)
    ts=o.get('timestamp')
    if ts:
        t=datetime.datetime.fromisoformat(ts.replace('Z','+00:00'))
        first=first or t; last=t
    m=o.get('message')
    if isinstance(m,dict):
        u=m.get('usage')
        if isinstance(u,dict) and 'input' in u:
            in_tok+=u.get('input',0); out_tok+=u.get('output',0)
print(in_tok,out_tok,(last-first).total_seconds())
EOF
# 26,323,203 input / 185,173 output / 4308s → avg_tps 43.0
```

## Raw transcript excerpt (evidence)

```
(paste the final usage line / /cost output / status output here)
```
