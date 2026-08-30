"""Per-file format auto-detection by probing the first lines."""

import json
from typing import Iterable

#: How many non-empty lines the probe inspects (spec: first 10 lines).
PROBE_LINES = 10

JSON_LINES_FORMAT = "jsonl"
TEXT_FORMAT = "text"


def looks_like_json_object(line: str) -> bool:
    """True when the line parses as a JSON object."""
    stripped = line.strip()
    if not stripped.startswith("{"):
        return False
    try:
        return isinstance(json.loads(stripped), dict)
    except (json.JSONDecodeError, ValueError):
        return False


def detect_format(lines: Iterable[str]) -> str:
    """Decide the parser format for a file from its first lines.

    Probes up to :data:`PROBE_LINES` non-empty lines; JSON-lines wins when at
    least half of them parse as JSON objects. Defaults to plain text.
    """
    probed = 0
    json_objects = 0
    for line in lines:
        if not line.strip():
            continue
        probed += 1
        if looks_like_json_object(line):
            json_objects += 1
        if probed >= PROBE_LINES:
            break
    if probed == 0:
        return TEXT_FORMAT
    return JSON_LINES_FORMAT if json_objects * 2 >= probed else TEXT_FORMAT
