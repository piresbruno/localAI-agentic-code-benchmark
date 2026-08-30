"""The Engine: streaming normalization pipeline, correlation windowing, scoring.

Events flow through one at a time; each rule receives its own tumbling
correlation window sized by the rule. Only the currently-open windows are
retained, so memory stays O(1) with respect to stream length.
"""

from collections import Counter
from datetime import datetime, timedelta, timezone
from typing import Iterable, Sequence

from loglens.engine.filters import TimeFilter
from loglens.engine.scoring import health_score
from loglens.engine.windows import EventWindow, aligned_start
from loglens.models import ErrorRatePoint, LogEvent, LogLevel, MessageCount, Report
from loglens.rules.base import BaseRule, create_default_rules, normalize_message


def _system_clock() -> datetime:
    return datetime.now(timezone.utc)


class Engine:
    """Run events through parsers' output and rules; assemble a Report."""

    def __init__(
        self,
        rules: Sequence[BaseRule] | None = None,
        *,
        time_filter: TimeFilter | None = None,
        clock=None,
        top_messages: int = 10,
        error_bucket: timedelta = timedelta(minutes=5),
    ) -> None:
        self.rules: list[BaseRule] = list(rules) if rules is not None else create_default_rules()
        self.time_filter = time_filter
        self.clock = clock or _system_clock
        self.top_messages = top_messages
        self.error_bucket = error_bucket
        self._reset()

    def _reset(self) -> None:
        self._processed = 0
        self._held_high_water = 0
        self._next_id = 0
        self._parse_errors = 0
        self._level_counts: Counter[str] = Counter()
        self._message_levels: dict[str, Counter[str]] = {}
        self._buckets: dict[datetime, list[int]] = {}
        self._first_ts: datetime | None = None
        self._last_ts: datetime | None = None
        self._incidents = []
        self._open_windows: dict[BaseRule, EventWindow | None] = {rule: None for rule in self.rules}

    def run(self, events: Iterable[LogEvent], *, inputs: Sequence[str] = ()) -> Report:
        """Process a lazy event stream end-to-end and return the Report."""
        self._reset()
        for event in events:
            self._process(event)
        self._close_all_windows()
        return self._build_report(inputs)

    # -- streaming stats ---------------------------------------------------

    @property
    def stats(self) -> dict[str, int]:
        """Processed vs. retained event counters (streaming evidence)."""
        held_now = sum(len(window) for window in self._open_windows.values() if window)
        return {"processed": self._processed, "held": max(self._held_high_water, held_now)}

    # -- pipeline ----------------------------------------------------------

    def _process(self, event: LogEvent) -> None:
        if self.time_filter is not None and not self.time_filter.matches(event):
            return
        self._processed += 1
        self._next_id += 1
        event.id = f"e{self._next_id}"
        if event.is_parse_error:
            self._parse_errors += 1
        self._level_counts[event.level.value] += 1
        if event.timestamp is not None:
            if self._first_ts is None or event.timestamp < self._first_ts:
                self._first_ts = event.timestamp
            if self._last_ts is None or event.timestamp > self._last_ts:
                self._last_ts = event.timestamp
            self._count_message(event)
            self._count_bucket(event)
            self._feed_rules(event)

    def _count_message(self, event: LogEvent) -> None:
        template = normalize_message(event.message) or "<blank>"
        levels = self._message_levels.setdefault(template, Counter())
        levels[event.level.value] += 1

    def _count_bucket(self, event: LogEvent) -> None:
        bucket = aligned_start(event.timestamp, self.error_bucket)
        stats = self._buckets.setdefault(bucket, [0, 0])
        stats[0] += 1
        if event.level in (LogLevel.ERROR, LogLevel.CRITICAL):
            stats[1] += 1

    def _feed_rules(self, event: LogEvent) -> None:
        assert event.timestamp is not None
        for rule in self.rules:
            duration = rule.window_duration()
            if duration is None:
                window = EventWindow(event.timestamp, event.timestamp)
                window.add(event)
                self._incidents.extend(rule.evaluate(window))
                continue
            window = self._open_windows.get(rule)
            if window is None:
                window = self._open_window(rule, event.timestamp, duration)
            elif event.timestamp >= window.end:
                self._incidents.extend(rule.evaluate(window))
                window = self._open_window(rule, event.timestamp, duration)
            window.add(event)
            self._held_high_water = max(self._held_high_water, len(window))

    def _open_window(self, rule: BaseRule, ts: datetime, duration: timedelta) -> EventWindow:
        start = aligned_start(ts, duration)
        window = EventWindow(start, start + duration)
        self._open_windows[rule] = window
        return window

    def _close_all_windows(self) -> None:
        for rule, window in self._open_windows.items():
            if window is not None and rule.window_duration() is not None:
                self._incidents.extend(rule.evaluate(window))
                self._open_windows[rule] = None

    # -- report ------------------------------------------------------------

    def _build_report(self, inputs: Sequence[str]) -> Report:
        incidents = sorted(
            self._incidents,
            key=lambda i: (i.first_timestamp or datetime.max.replace(tzinfo=timezone.utc), i.rule),
        )
        series = [
            ErrorRatePoint(
                bucket_start=bucket,
                total=stats[0],
                errors=stats[1],
                ratio=stats[1] / stats[0] if stats[0] else 0.0,
            )
            for bucket, stats in sorted(self._buckets.items())
        ]
        return Report(
            generated_at=self.clock(),
            inputs=list(inputs),
            events_total=self._processed,
            parse_errors=self._parse_errors,
            level_counts=dict(self._level_counts),
            first_timestamp=self._first_ts,
            last_timestamp=self._last_ts,
            health_score=health_score(incidents),
            incidents=incidents,
            top_messages=self._top_messages(),
            error_rate_series=series,
        )

    def _top_messages(self) -> list[MessageCount]:
        ranked = sorted(
            self._message_levels.items(),
            key=lambda item: (-sum(item[1].values()), item[0]),
        )[: self.top_messages]
        return [
            MessageCount(
                message=template,
                count=sum(levels.values()),
                level=levels.most_common(1)[0][0],
            )
            for template, levels in ranked
        ]
