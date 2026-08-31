#!/usr/bin/env bash
# Scaffold a new benchmark run directory. The tested MODEL is always identified
# in the directory name: results/<project>/<model>-<harness>-<date>-<run-number>
#
# <run-number> is the count of prior runs of the same project+model+harness
# (searched in results/ AND results-archive/), so the same model can be run
# many times — even several times a day — with stable, comparable ids:
#   results/deskboard/gpt-5.3-pi-20260829-1
#   results/deskboard/gpt-5.3-pi-20260829-2   (second run, e.g. after tuning)
#   results/deskboard/gpt-5.3-pi-20260902-3   (third run, a later day)
#
# Usage: ./scripts/new-run.sh <project-id> <model> [harness]
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PROJECT_ID="${1:?usage: new-run.sh <project-id> <model> [harness]}"
MODEL="${2:?usage: new-run.sh <project-id> <model> [harness]}"
HARNESS="${3:-agent}"
DATE="$(date +%Y%m%d)"
# Run number = # of prior runs of this project+model+harness (+1), searched in
# both results/ and results-archive/ so archived runs keep counting.
count=0
for base in "${REPO_ROOT}/results" "${REPO_ROOT}/results-archive"; do
  while IFS= read -r d; do
    count=$((count + 1))
  done < <(find "${base}/${PROJECT_ID}" -maxdepth 1 -mindepth 1 -type d -name "${MODEL}-${HARNESS}-*" 2>/dev/null || true)
done
N=$((count + 1))
while [[ -e "${REPO_ROOT}/results/${PROJECT_ID}/${MODEL}-${HARNESS}-${DATE}-${N}" ]]; do
  N=$((N + 1))
done
RUN_ID="${MODEL}-${HARNESS}-${DATE}-${N}"
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

# Isolation guard: the working tree must never show a previous run's
# implementation to the next agent (contamination block — RUBRIC gate G6).
PRIOR="$(find "${REPO_ROOT}/results" -mindepth 2 -maxdepth 2 -type d -not -empty 2>/dev/null || true)"
if [[ -n "${PRIOR}" ]]; then
  echo "error: prior run directories are visible under results/ — contamination risk:" >&2
  sed 's/^/       /' <<<"${PRIOR}" >&2
  echo "       run ./scripts/archive-results.sh first, then retry." >&2
  exit 3
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
    -e "s/{MODEL}/${MODEL//\//\\/}/g" \
    "$tpl"
done
# METRICS.md knows the model from the start
sed -i "s/^model:.*/model: ${MODEL//\//\\/}/" "${RUN_DIR}/METRICS.md"

cat <<EOF

Run directory ready: ${RUN_DIR}
  project=${PROJECT_ID}  model=${MODEL}  harness=${HARNESS}  run_id=${RUN_ID}

Next steps:
  1. cd ${RUN_DIR}
  2. Launch your agent with cwd = this directory (it auto-reads AGENTS.md)
  3. Paste the prompt from PROMPT_TEMPLATE.md with:
       SPEC_PATH   = ${SPEC_DIR}/SPEC.md
       REPO_ROOT   = ${REPO_ROOT}
       RUN_DIR     = ${RUN_DIR}
  4. After grading: fill METRICS.md yaml block (incl. verdict + score),
     then ./scripts/build-report.py to regenerate results/RESULTS.md (markdown).
  5. Before the next run: ./scripts/archive-results.sh — moves this run into
     results-archive/ (kept in git; the active-run isolation gate only checks results/).
EOF
