#!/usr/bin/env bash
# Scaffold a new benchmark run directory. The tested MODEL is always identified
# in the directory name: results/<project>/<model>-<harness>-<date>/
# Usage: ./scripts/new-run.sh <project-id> <model> [harness]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="${1:?usage: new-run.sh <project-id> <model> [harness]}"
MODEL="${2:?usage: new-run.sh <project-id> <model> [harness]}"
HARNESS="${3:-agent}"
DATE="$(date +%Y%m%d)"
RUN_ID="${MODEL}-${HARNESS}-${DATE}"
RUN_DIR="${REPO_ROOT}/results/${PROJECT_ID}/${RUN_ID}"

SPEC_DIR="$(ls -d "${REPO_ROOT}"/specs/*-"${PROJECT_ID}" 2>/dev/null | head -1 || true)"
if [[ -z "${SPEC_DIR}" ]]; then
  known="$(ls "${REPO_ROOT}"/specs | sed 's/^[0-9]*-//' | paste -sd', ' -)"
  echo "error: unknown project-id '${PROJECT_ID}'. Known ids: ${known}" >&2
  exit 2
fi

if [[ -e "${RUN_DIR}" ]]; then
  echo "error: run dir already exists: ${RUN_DIR}" >&2
  exit 2
fi

mkdir -p "${RUN_DIR}/tasks"
cp "${REPO_ROOT}/templates/result-template.md" "${RUN_DIR}/RESULT.md"
cp "${REPO_ROOT}/templates/metrics-template.md" "${RUN_DIR}/METRICS.md"
# Agent brief: copied in so every harness auto-loads it from the run cwd
cp "${REPO_ROOT}/AGENTS.md" "${RUN_DIR}/AGENTS.md"
cp "${REPO_ROOT}/AGENTS.md" "${RUN_DIR}/CLAUDE.md"

# Fill known placeholders in RESULT.md and METRICS.md
for tpl in "${RUN_DIR}/RESULT.md" "${RUN_DIR}/METRICS.md"; do
  sed -i \
    -e "s/{PROJECT_ID}/${PROJECT_ID}/g" \
    -e "s/{AGENT_NAME}/${HARNESS}/g" \
    -e "s/{RUN_ID}/${PROJECT_ID}\/${RUN_ID}/g" \
    -e "s/{DATE}/$(date +%Y-%m-%d)/g" \
    "$tpl"
done
# METRICS.md knows the model from the start
sed -i "s/^model:.*/model: ${MODEL//\//\\/}/" "${RUN_DIR}/METRICS.md"

cat <<EOF

Run directory ready: ${RUN_DIR}
  project=${PROJECT_ID}  model=${MODEL}  harness=${HARNESS}

Next steps:
  1. cd ${RUN_DIR}
  2. Launch your agent with cwd = this directory (it auto-reads AGENTS.md)
  3. Paste the prompt from PROMPT_TEMPLATE.md with:
       SPEC_PATH   = ${SPEC_DIR}/SPEC.md
       REPO_ROOT   = ${REPO_ROOT}
       RUN_DIR     = ${RUN_DIR}
  4. After grading: fill METRICS.md yaml block (incl. verdict + score),
     then ./scripts/build-report.py to update the global ranking HTML.
EOF
