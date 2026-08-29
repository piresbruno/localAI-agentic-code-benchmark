#!/usr/bin/env python3
"""Build/append the global benchmark results HTML with ranking.

Scans results/<project>/<run>/METRICS.md machine-readable yaml blocks,
ranks models per project (score desc, then fewer tokens, then higher t/s),
computes an overall leaderboard, and regenerates results/index.html.

Every execution re-reads ALL completed runs, so previously graded models
remain in the ranking — new results are effectively appended.

Usage: scripts/build-report.py [--repo-root PATH]
"""
from __future__ import annotations

import argparse
import datetime as dt
import html
import json
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
    return html.escape(str(v)) if v not in (None, "") else "—"


VERDICT_COLOR = {"PASS": "#1a7f37", "PASS-WITH-NOTES": "#9a6700", "FAIL": "#cf222e"}


def table(runs, show_rank=True) -> str:
    head = ("<tr><th>#</th><th>Model</th><th>Harness</th><th>Date</th>"
            "<th>Verdict</th><th>Score /100</th><th>Total tokens</th>"
            "<th>Avg t/s</th><th>Wall time</th><th>Run dir</th></tr>")
    rows = []
    for i, r in enumerate(runs, 1):
        verdict = r.get("verdict", "").upper()
        color = VERDICT_COLOR.get(verdict, "#57606a")
        # Run dir name is <model>-<harness>-<YYYYMMDD>[-vN]; model names may
        # contain dashes, so find the date with a regex instead of splitting.
        dm = re.search(r"(\d{8})(-v\d+)?$", r["_run_id"])
        date = dm.group(1) if dm else ""
        rows.append(
            "<tr>"
            f"<td>{i}</td><td><strong>{esc(r.get('model'))}</strong></td>"
            f"<td>{esc(r.get('agent'))}</td><td>{esc(date)}</td>"
            f"<td style='color:{color};font-weight:600'>{esc(verdict or '—')}</td>"
            f"<td>{esc(r.get('score'))}</td>"
            f"<td>{fmt_int(r.get('total_tokens'))}</td>"
            f"<td>{esc(r.get('avg_tps'))}</td>"
            f"<td>{esc(r.get('wall_time'))}</td>"
            f"<td><code>{esc(r['_run_id'])}</code></td>"
            "</tr>")
    rank_col = "" if show_rank else head.replace("<th>#</th>", "")
    return f"<table>{head if show_rank else rank_col}{''.join(rows)}</table>"


def build_html(runs: list[dict], repo_root: Path) -> str:
    now = dt.datetime.now().strftime("%Y-%m-%d %H:%M")
    projects = sorted({r["project"] for r in runs})
    css = """
    body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:1100px;
         margin:2rem auto;padding:0 1rem;color:#1f2328;line-height:1.5}
    h1{border-bottom:2px solid #1f2328;padding-bottom:.4rem}
    h2{margin-top:2.5rem;border-bottom:1px solid #d0d7de;padding-bottom:.3rem}
    table{border-collapse:collapse;width:100%;margin:1rem 0;font-size:.92rem}
    th,td{border:1px solid #d0d7de;padding:.45rem .6rem;text-align:left}
    th{background:#f6f8fa;position:sticky;top:0}
    tr:nth-child(even) td{background:#fbfcfd}
    code{background:#eff2f5;padding:.1rem .35rem;border-radius:4px;font-size:.85em}
    .meta{color:#57606a;font-size:.9rem}
    .podium td:first-child{font-weight:700}
    """
    parts = [
        "<!DOCTYPE html><html lang='en'><head><meta charset='utf-8'>",
        "<meta name='viewport' content='width=device-width,initial-scale=1'>",
        "<title>code-benchmark — global results</title>",
        f"<style>{css}</style></head><body>",
        "<h1>code-benchmark — global results</h1>",
        f"<p class='meta'>Generated {esc(now)} · {len(runs)} graded run(s) · "
        f"{len(projects)} project(s) · ranking: score ↓, tokens ↑, t/s ↓ · "
        "regenerated by <code>scripts/build-report.py</code> after every execution</p>",
    ]

    for project in projects:
        pruns = sorted([r for r in runs if r["project"] == project], key=rank_key)
        parts.append(f"<h2>Project: {esc(project)}</h2>")
        parts.append(table(pruns))

    # Overall leaderboard: average score across projects attempted per model
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
    parts.append("<h2>Overall model ranking</h2>")
    parts.append("<table><tr><th>#</th><th>Model</th><th>Projects</th>"
                 "<th>Runs</th><th>Pass rate</th><th>Avg score</th>"
                 "<th>Total tokens (all runs)</th><th>Avg t/s</th></tr>")
    for i, b in enumerate(board, 1):
        parts.append(
            f"<tr class='podium'><td>{i}</td><td><strong>{esc(b['model'])}</strong></td>"
            f"<td>{b['projects']}</td><td>{b['runs']}</td>"
            f"<td>{esc(b['pass_rate'])}</td><td>{esc(b['avg_score'])}</td>"
            f"<td>{fmt_int(b['total_tokens'])}</td><td>{esc(b['avg_tps'])}</td></tr>")
    parts.append("</table>")

    # Chronological run log — newest appended at the bottom
    parts.append("<h2>Run log (chronological)</h2>")
    chrono = sorted(runs, key=lambda r: (r["_run_id"]))
    log_rows = "".join(
        f"<tr><td>{esc(r['project'])}</td><td>{esc(r['model'])}</td>"
        f"<td>{esc(r.get('verdict'))}</td><td>{esc(r.get('score'))}</td>"
        f"<td><code>{esc(r['_run_id'])}</code></td>"
        f"<td><code>{esc(r['_dir'])}</code></td></tr>"
        for r in chrono)
    parts.append("<table><tr><th>Project</th><th>Model</th><th>Verdict</th>"
                 f"<th>Score</th><th>Run</th><th>Directory</th></tr>{log_rows}</table>")

    parts.append("</body></html>")
    return "".join(parts)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--repo-root", default=str(Path(__file__).resolve().parent.parent))
    args = ap.parse_args()
    root = Path(args.repo_root)
    results_dir = root / "results"
    metrics_files = sorted(results_dir.glob("*/*/METRICS.md"))
    runs = [m for m in (parse_metrics(p) for p in metrics_files) if m]

    if not runs:
        print("No graded runs found (results/*/*/METRICS.md with a filled yaml block).")
        print("Scaffold with scripts/new-run.sh, run, grade, fill the yaml block, retry.")
        return 1

    out = root / "results" / "index.html"
    out.write_text(build_html(runs, root), encoding="utf-8")
    # machine-readable companion for CI / tooling
    (root / "results" / "index.json").write_text(
        json.dumps(runs, indent=2, default=str), encoding="utf-8")
    print(f"Global results updated: {out}")
    print(f"  runs ranked: {len(runs)} across {len({r['project'] for r in runs})} project(s)")
    for project in sorted({r["project"] for r in runs}):
        best = sorted([r for r in runs if r["project"] == project], key=rank_key)[0]
        print(f"  {project}: #1 {best['model']} (score={best.get('score', '—')})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
