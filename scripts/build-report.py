#!/usr/bin/env python3
"""Build the global benchmark results as Markdown: results/RESULTS.md.

Scans the METRICS.md machine-readable yaml blocks of every run found under
  results/<project>/<run>/METRICS.md          (active run)
  results-archive/<project>/<run>/METRICS.md  (archived runs, still ranked)
ranks models per project (score desc, then fewer tokens, then higher t/s),
computes an overall leaderboard, and regenerates results/RESULTS.md.

Every execution re-reads ALL runs — archived ones included — so previously
graded results stay in the ranking. No HTML, no JSON companion: Markdown only.

Usage: scripts/build-report.py [--repo-root PATH]
"""
from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path

YAML_KEYS = ["project", "agent", "model", "wall_time", "total_tokens",
             "input_tokens", "output_tokens", "avg_tps", "cost",
             "verdict", "score"]


def parse_metrics(path: Path) -> dict | None:
    """Parse the ```yaml fenced block in a METRICS.md file."""
    text = path.read_text(encoding="utf-8", errors="replace")
    m = re.search(r"```yaml\s*\n(.*?)```", text, re.DOTALL)
    if not m:
        return None
    data: dict = {}
    for line in m.group(1).splitlines():
        if ":" not in line:
            continue
        key, _, value = line.partition(":")
        key, value = key.strip(), value.split("#")[0].strip()
        if key in YAML_KEYS and value:
            data[key] = value
    # sanity: a run needs project + model + at least one metric
    if "project" not in data or "model" not in data:
        return None
    if not any(k in data for k in ("total_tokens", "wall_time", "score")):
        return None
    data["_run_id"] = path.parent.name
    data["_dir"] = str(path.parent)
    return data


def to_num(value, cast=float):
    try:
        return cast(re.sub(r"[^\d.\-]", "", str(value)))
    except (ValueError, TypeError):
        return None


def fmt_int(value) -> str:
    n = to_num(value, int)
    return f"{n:,}" if n is not None else "—"


def rank_key(run):
    score = to_num(run.get("score"), float)
    tokens = to_num(run.get("total_tokens"), int)
    tps = to_num(run.get("avg_tps"), float)
    return (-(score if score is not None else -1),
            tokens if tokens is not None else sys.maxsize,
            -(tps if tps is not None else -1))


def esc(v) -> str:
    """Escape pipes for a Markdown table cell; em-dash for empty."""
    if v in (None, ""):
        return "—"
    return str(v).replace("|", "\\|")


VERDICT_LABEL = {"PASS": "✅ PASS", "PASS-WITH-NOTES": "🟡 PASS-WITH-NOTES", "FAIL": "❌ FAIL"}


def md_table(headers: list[str], rows: list[list[str]]) -> str:
    out = ["| " + " | ".join(headers) + " |",
           "|" + "|".join("---" for _ in headers) + "|"]
    out.extend("| " + " | ".join(r) + " |" for r in rows)
    return "\n".join(out)


def project_section(project: str, runs: list[dict]) -> str:
    parts = [f"## Project: {esc(project)}", ""]
    headers = ["#", "Model", "Harness", "Date", "Verdict", "Score /100",
               "Total tokens", "Avg t/s", "Wall time", "Run", "Status"]
    rows = []
    for i, r in enumerate(runs, 1):
        verdict = r.get("verdict", "").upper()
        dm = re.search(r"(\d{8})(-v\d+)?$", r["_run_id"])
        date = dm.group(1) if dm else ""
        status = "🗄 archived" if "results-archive" in r["_dir"] else "● active"
        rows.append([
            str(i), f"**{esc(r.get('model'))}**", esc(r.get("agent")), date,
            esc(VERDICT_LABEL.get(verdict, verdict or "—")), esc(r.get("score")),
            fmt_int(r.get("total_tokens")), esc(r.get("avg_tps")),
            esc(r.get("wall_time")), f"`{esc(r['_run_id'])}`", status,
        ])
    parts.append(md_table(headers, rows))
    return "\n".join(parts)


def leaderboard_section(runs: list[dict]) -> str:
    models: dict[str, list[dict]] = {}
    for r in runs:
        models.setdefault(r["model"], []).append(r)
    board = []
    for model, mruns in models.items():
        scores = [to_num(r.get("score"), float) for r in mruns]
        scores = [s for s in scores if s is not None]
        tps = [to_num(r.get("avg_tps"), float) for r in mruns]
        tps = [t for t in tps if t is not None]
        tokens = [to_num(r.get("total_tokens"), int) for r in mruns]
        tokens = [t for t in tokens if t is not None]
        passes = sum(1 for r in mruns if r.get("verdict", "").upper().startswith("PASS"))
        board.append({
            "model": model,
            "runs": len(mruns),
            "projects": len({r["project"] for r in mruns}),
            "avg_score": round(sum(scores) / len(scores), 1) if scores else None,
            "pass_rate": f"{passes}/{len(mruns)}",
            "total_tokens": sum(tokens) if tokens else None,
            "avg_tps": round(sum(tps) / len(tps), 1) if tps else None,
        })
    board.sort(key=lambda b: (-(b["avg_score"] or -1), b["total_tokens"] or sys.maxsize))
    headers = ["#", "Model", "Projects", "Runs", "Pass rate", "Avg score",
               "Total tokens (all runs)", "Avg t/s"]
    rows = [[str(i), f"**{esc(b['model'])}**", str(b["projects"]), str(b["runs"]),
             esc(b["pass_rate"]), esc(b["avg_score"]), fmt_int(b["total_tokens"]),
             esc(b["avg_tps"])] for i, b in enumerate(board, 1)]
    return "\n".join(["## Overall model ranking", "", md_table(headers, rows)])


def run_log_section(runs: list[dict]) -> str:
    headers = ["Project", "Model", "Verdict", "Score", "Run", "Directory"]
    rows = [[esc(r["project"]), esc(r["model"]),
             esc(r.get("verdict") or "—"), esc(r.get("score") or "—"),
             f"`{esc(r['_run_id'])}`", f"`{esc(r['_dir'])}`"]
            for r in sorted(runs, key=lambda r: r["_run_id"])]
    return "\n".join(["## Run log (chronological)", "", md_table(headers, rows)])


def build_markdown(runs: list[dict]) -> str:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    projects = sorted({r["project"] for r in runs})
    parts = [
        "# code-benchmark — global results",
        "",
        f"_Generated {esc(now)} · {len(runs)} graded run(s) · {len(projects)} project(s) · "
        "ranking: score ↓, tokens ↑, t/s ↓ · regenerated by `scripts/build-report.py` "
        "after every execution. Archived runs (moved out of the working tree by "
        "`scripts/archive-results.sh`) stay ranked._",
        "",
    ]
    for project in projects:
        pruns = sorted([r for r in runs if r["project"] == project], key=rank_key)
        parts.append(project_section(project, pruns))
        parts.append("")
    parts.append(leaderboard_section(runs))
    parts.append("")
    parts.append(run_log_section(runs))
    parts.append("")
    return "\n".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo-root", default=str(Path(__file__).resolve().parent.parent))
    args = ap.parse_args()
    root = Path(args.repo_root)
    metrics_files = sorted(root.glob("results/*/*/METRICS.md"))
    metrics_files += sorted(root.glob("results-archive/*/*/METRICS.md"))
    runs = [m for m in (parse_metrics(p) for p in metrics_files) if m]

    if not runs:
        print("No graded runs found (results/ or results-archive/ with a filled METRICS.md yaml block).")
        print("Scaffold with scripts/new-run.sh, run, grade, fill the yaml block, retry.")
        return 1

    out = root / "results" / "RESULTS.md"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(build_markdown(runs), encoding="utf-8")
    print(f"Global results updated: {out}")
    print(f"  runs ranked: {len(runs)} across {len({r['project'] for r in runs})} project(s)")
    for project in sorted({r["project"] for r in runs}):
        best = sorted([r for r in runs if r["project"] == project], key=rank_key)[0]
        print(f"  {project}: #1 {best['model']} (score={best.get('score', '—')})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
