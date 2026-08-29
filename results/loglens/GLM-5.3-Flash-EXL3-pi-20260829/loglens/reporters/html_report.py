"""HTML reporter: single self-contained file (inline CSS, inline SVG sparkline)."""

from __future__ import annotations

from pathlib import Path

from jinja2 import Environment, FileSystemLoader

from loglens.models.report import Report

SEVERITY_CLASS = {"critical": "critical", "warn": "warn", "info": "info"}


def sparkline_svg(points: list[tuple[float, float]], width: int = 640, height: int = 80) -> str:
    """Inline SVG polyline for the error-rate series (0..1 → bottom..top)."""
    if not points:
        return '<svg class="sparkline" width="0" height="0"></svg>'
    n = len(points)
    max_ts = points[-1][0]
    min_ts = points[0][0]
    span = max(max_ts - min_ts, 1e-9)
    step_x = width / max(n - 1, 1)
    coords = []
    for i, (_ts, rate) in enumerate(points):
        x = i * step_x if n > 1 else width / 2
        y = height - min(rate, 1.0) * (height - 6) - 3
        coords.append(f"{x:.1f},{y:.1f}")
    area = f"M0,{height} L" + " L".join(coords) + f" L{width},{height} Z"
    return (
        f'<svg class="sparkline" width="{width}" height="{height}" viewBox="0 0 {width} {height}" '
        f'role="img" aria-label="Error rate over time ({n} buckets, t0={min_ts:.0f}, span={span:.0f}s)">'
        f'<path d="{area}" fill="rgba(185,28,28,0.12)"/>'
        f'<polyline points="{" ".join(coords)}" fill="none" stroke="#b91c1c" stroke-width="2"/>'
        "</svg>"
    )


def _score_color(score: int) -> str:
    return "#15803d" if score >= 80 else "#b45309" if score >= 50 else "#b91c1c"


def render_html(report: Report) -> str:
    """Render the report as a single self-contained HTML document."""
    env = Environment(
        loader=FileSystemLoader(str(Path(__file__).parent)),
        autoescape=True,
    )
    template = env.get_template("report.html.j2")
    points = [(p.bucket_start.timestamp(), p.rate) for p in report.error_rate_series]
    return template.render(
        report=report,
        sparkline=sparkline_svg(points),
        score_color=_score_color(report.health_score),
        severity_class=SEVERITY_CLASS,
    )


def write_html(report: Report, out_path: str | Path) -> Path:
    """Write the self-contained HTML report; returns the written path."""
    path = Path(out_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(render_html(report), encoding="utf-8")
    return path
