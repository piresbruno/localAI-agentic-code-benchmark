#!/usr/bin/env bash
# Inverse of archive-results.sh: move archived runs back into results/.
# Runs come back tracked (git mv) when they were tracked in results-archive/.
#
# Usage: ./scripts/restore-results.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_ROOT="${REPO_ROOT}/results-archive"

shopt -s nullglob
runs=("${ARCHIVE_ROOT}"/*/*/)

if [[ ${#runs[@]} -eq 0 ]]; then
  echo "Nothing to restore: results-archive/ is empty."
  exit 0
fi

for run_dir in "${runs[@]}"; do
  rel="${run_dir%"${run_dir##*[!/]}"}"              # strip trailing slash(es)
  rel_arch="${rel#"${REPO_ROOT}"/}"                 # results-archive/<project>/<run>
  dest_rel="results/${rel_arch#results-archive/}"
  dest="${REPO_ROOT}/${dest_rel}"
  if [[ -e "${dest}" ]]; then
    echo "error: ${dest_rel} already exists — refusing to overwrite" >&2
    exit 1
  fi
  mkdir -p "$(dirname "${dest}")"
  if git -C "${REPO_ROOT}" ls-files --error-unmatch "${rel_arch}" >/dev/null 2>&1; then
    git -C "${REPO_ROOT}" mv "${rel_arch}" "${dest_rel}"
  else
    mv "${run_dir}" "${dest}"
  fi
  echo "restored: ${rel_arch} -> ${dest_rel}"
done

# drop now-empty project dirs (and the archive root) when everything moved back
for proj_dir in "${ARCHIVE_ROOT}"/*/; do
  rmdir "${proj_dir}" 2>/dev/null || true
done
rmdir "${ARCHIVE_ROOT}" 2>/dev/null || true

echo "Note: runs restored with their tracking state preserved."
