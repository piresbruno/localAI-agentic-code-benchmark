"""HTML reporter: single self-contained file (inline CSS, inline SVG sparkline)."""

from jinja2 import Environment, PackageLoader, select_autoescape

from loglens.models import Report
from loglens.reporters.base import register_reporter

_env = Environment(
    loader=PackageLoader("loglens.reporters", "templates"),
    autoescape=select_autoescape(("html", "j2", "xml")),
)


@register_reporter("html")
def render_html(report: Report, out: object | None = None) -> None:
    """Render the self-contained HTML report to *out* (file opened by caller)."""
    template = _env.get_template("report.html.j2")
    html = template.render(
        report=report,
        sparkline=sparkline_svg(report.error_rate_series),
        score_class=_score_class(report.health_score),
    )
    target = out if out is not None else _stdout()
    target.write(html)


def sparkline_svg(series, width: int = 720, height: int = 80) -> str:
    """Inline SVG sparkline of the per-bucket error ratio (0..1)."""
    pad = 4
    inner_w, inner_h = width - 2 * pad, height - 2 * pad
    if len(series) < 2:
        ratio = series[0].ratio if series else 0.0
        y = height - pad - ratio * inner_h
        return _svg(width, height, [f"M {pad},{y:.1f} L {width - pad},{y:.1f}"])
    step = inner_w / (len(series) - 1)
    points = []
    for index, point in enumerate(series):
        x = pad + index * step
        y = height - pad - min(max(point.ratio, 0.0), 1.0) * inner_h
        points.append(f"{x:.1f},{y:.1f}")
    line = "M " + " L ".join(points)
    area = line + f" L {pad + inner_w:.1f},{height - pad} L {pad},{height - pad} Z"
    return _svg(width, height, [line, area], area=True)


def _svg(width: int, height: int, paths: list[str], area: bool = False) -> str:
    area_path = f'<path d="{paths[1]}" class="spark-area"/>' if area else ""
    return (
        f'<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" '
        f'role="img" aria-label="Error rate over time" class="sparkline">'
        f'{area_path}<path d="{paths[0]}" class="spark-line"/></svg>'
    )


def _score_class(score: int) -> str:
    if score >= 80:
        return "good"
    if score >= 50:
        return "fair"
    return "poor"


def _stdout() -> object:
    import sys

    return sys.stdout
