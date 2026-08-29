"""Engine: normalization pipeline — parse → filter → window → rules → report.

The Engine is the library core; the CLI is a thin shell over it.
Events stream in lazily and are evaluated in tumbling correlation windows:
at most one window per rule is retained at any time, so memory is O(window),
never O(stream).
"""

from __future__ import annotations

from collections import Counter
from collections.abc import Callable, Iterable
from datetime import UTC, datetime, timedelta

from loglens.engine.scoring import compute_health_score
from loglens.engine.windowing import WindowBuffer
from loglens.models.config import DEFAULT_CONFIG, RuleConfig
from loglens.models.event import LogEvent
from loglens.models.incident import Incident
from loglens.models.report import ErrorRatePoint, Report, TimeRange, TopMessage
from loglens.parsers.base import Parser
from loglens.rules.registry import BUILTIN_REGISTRY, RuleRegistry

BUCKET_SECONDS = 60  # error-rate series granularity
TOP_MESSAGES = 10
EPOCH = datetime(1970, 1, 1, tzinfo=UTC)


class Engine:
    """Runs the full pipeline over any iterable of (source, line) pairs."""

    def __init__(
        self,
        parser: Parser,
        config: RuleConfig | None = None,
        clock: Callable[[], datetime] | None = None,
        registry: RuleRegistry | None = None,
    ) -> None:
        self.parser = parser
        self.config = config or DEFAULT_CONFIG
        self.clock = clock or (lambda: datetime.now(tz=UTC))
        self.registry = registry or BUILTIN_REGISTRY

    def _event_stream(self, line_source: Iterable[tuple[str, str]]) -> Iterable[LogEvent]:
        """Normalize (source, line) pairs into a single event stream.

        Streaming parsers (auto-detection) get the whole pair stream; simple
        stateless parsers are applied per line.
        """
        if hasattr(self.parser, "parse_stream"):
            return self.parser.parse_stream(line_source, self.clock)  # type: ignore[attr-defined]
        return (self.parser.parse_line(line, source, self.clock) for source, line in line_source)

    def iter_events(
        self,
        line_source: Iterable[tuple[str, str]],
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> Iterable[LogEvent]:
        """Stream normalized (and time-filtered) events without aggregating.

        Used by `loglens parse`; also handy in a REPL or for downstream tools.
        """
        for event_id, event in enumerate(self._event_stream(line_source), start=1):
            if since is not None and event.timestamp < since:
                continue
            if until is not None and event.timestamp > until:
                continue
            event.event_id = event_id
            yield event

    def analyze(
        self,
        line_source: Iterable[tuple[str, str]],
        since: datetime | None = None,
        until: datetime | None = None,
    ) -> Report:
        """Process all lines and produce a Report.

        Lines are consumed lazily; per-rule tumbling windows flush as soon as
        an event crosses a window boundary, so retained events stay bounded.
        """
        rules = self.registry.instantiate(self.config)
        buffers = [WindowBuffer(rule) for rule in rules]
        event_stream = self._event_stream(line_source)

        level_counts: Counter[str] = Counter()
        bucket_totals: Counter[int] = Counter()
        bucket_errors: Counter[int] = Counter()
        message_counts: Counter[tuple[str, str]] = Counter()
        incidents: list[Incident] = []
        first_ts: datetime | None = None
        last_ts: datetime | None = None
        total = 0
        unknown = 0
        sources: list[str] = []

        for event in event_stream:
            total += 1
            if event.source not in sources:
                sources.append(event.source)
            if since is not None and event.timestamp < since:
                continue
            if until is not None and event.timestamp > until:
                continue

            event.event_id = total  # stable sequence number post-filter
            level_counts[event.level] += 1
            if event.level == "UNKNOWN":
                unknown += 1
            bucket = int((event.timestamp - EPOCH).total_seconds()) // BUCKET_SECONDS
            bucket_totals[bucket] += 1
            if event.is_error:
                bucket_errors[bucket] += 1
            message_counts[(event.message[:200], event.level)] += 1
            if first_ts is None or event.timestamp < first_ts:
                first_ts = event.timestamp
            if last_ts is None or event.timestamp > last_ts:
                last_ts = event.timestamp

            for buffer in buffers:
                incidents.extend(buffer.push(event))

        for buffer in buffers:
            incidents.extend(buffer.flush())

        incidents.sort(key=lambda i: i.first_seen)
        return Report(
            generated_at=self.clock(),
            sources=sources,
            total_events=total,
            unknown_events=unknown,
            level_counts=dict(level_counts),
            time_range=TimeRange(first=first_ts, last=last_ts),
            health_score=compute_health_score(incidents, total),
            incidents=incidents,
            error_rate_series=_build_series(bucket_totals, bucket_errors),
            top_messages=_top_messages(message_counts),
        )


def _build_series(totals: Counter[int], errors: Counter[int]) -> list[ErrorRatePoint]:
    return [
        ErrorRatePoint(
            bucket_start=EPOCH + timedelta(seconds=bucket * BUCKET_SECONDS),
            total=totals[bucket],
            errors=errors[bucket],
        )
        for bucket in sorted(totals)
    ]


def _top_messages(counts: Counter[tuple[str, str]], limit: int = TOP_MESSAGES) -> list[TopMessage]:
    return [TopMessage(message=msg, count=count, level=level) for (msg, level), count in counts.most_common(limit)]
