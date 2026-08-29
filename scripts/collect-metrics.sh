#!/usr/bin/env bash
# Aggregate per-project benchmark metrics (tokens, avg t/s, wall time) from graded runs.
# Usage: ./scripts/collect-metrics.sh [run-dir ...]
# With no args, scans results/*/*/METRICS.md.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DIRS=(${@:-${REPO_ROOT}/results/*/*/METRICS.md})

if ! ls "${DIRS[@]}" >/dev/null 2>&1; then
  echo "No METRICS.md files found. Run scripts/new-run.sh, execute a run, fill METRICS.md." >&2
  exit 1
fi

for f in "${DIRS[@]}"; do
  [[ -f "$f" ]] || { echo "skip: $f (not found)" >&2; continue; }
  # pull the yaml block keys
  get() { awk '/^```yaml/{flag=1;next}/^```/{flag=0}flag && $1 ~ /^'"$1"':/ {sub(/^[^:]*:[[:space:]]*/,""); print; exit}' "$f"; }
  project="$(get project)"; agent="$(get agent)"; model="$(get model)"
  wall="$(get wall_time)"; total="$(get total_tokens)"; out="$(get output_tokens)"
  tps="$(get avg_tps)"
  [[ -z "$project" || -z "$total" ]] && { echo "incomplete: $f (fill the yaml block)" >&2; continue; }
  printf '%s|%s|%s|%s|%s|%s|%s\n' "$project" "$agent" "$model" "$total" "$out" "$tps" "$wall"
done | sort -t'|' -k1,1 | awk -F'|' '
  BEGIN { print "Per-project metrics (total tokens | output tokens | avg t/s | wall time)\n" }
  $1 != prev && prev != "" { print "" }
  prev != $1 { print "## " $1; print "agent | model | total_tokens | output_tokens | avg_t/s | wall_time"; print "---|---|---|---|---|---" }
  { print $2 " | " ($3==""?"—":$3) " | " $4 " | " ($5==""?"—":$5) " | " ($6==""?"—":$6) " | " $7 }
  { prev=$1 }
  END { if (prev!="") print "" }
'
