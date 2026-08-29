"""Message templating: normalize a message so variable parts collapse.

Numbers are wild-carded so "Connection refused to db-1 (attempt 3)" and
"Connection refused to db-2 (attempt 7)" share one template.
"""

from __future__ import annotations

import hashlib
import re

_NUMBER_RE = re.compile(r"\b\d+(?:\.\d+)?\b")
_HEX_RE = re.compile(r"\b0x[0-9a-fA-F]+\b")
_QUOTED_RE = re.compile(r"'[^']*'|\"[^\"]*\"")
_UUID_RE = re.compile(r"[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}")
_WHITESPACE_RE = re.compile(r"\s+")


def normalize_message(message: str) -> str:
    """Collapse numbers, hex ids, quoted strings, and UUIDs into placeholders."""
    text = _UUID_RE.sub("<id>", message)
    text = _HEX_RE.sub("<num>", text)
    text = _QUOTED_RE.sub("<q>", text)
    text = _NUMBER_RE.sub("<num>", text)
    return _WHITESPACE_RE.sub(" ", text).strip()


def template_key(message: str) -> str:
    """Hashable key for grouping normalized messages."""
    return normalize_message(message)


def template_digest(message: str) -> str:
    """Short digest for display."""
    return hashlib.md5(template_key(message).encode()).hexdigest()[:8]  # noqa: S324 — display only
