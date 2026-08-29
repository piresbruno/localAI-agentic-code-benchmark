"""Domain errors. The CLI maps these onto exit codes; messages are safe to print."""

from __future__ import annotations


class LogLensError(Exception):
    """Base class for all LogLens errors (never leak internals)."""


class ConfigError(LogLensError):
    """Invalid configuration file or value."""

    def __init__(self, message: str, file: str | None = None, line: int | None = None) -> None:
        self.file = file
        self.line = line
        location = ""
        if file is not None:
            location = f" ({file}"
            if line is not None:
                location += f", line {line}"
            location += ")"
        super().__init__(f"{message}{location}")


class SourceError(LogLensError):
    """An input source could not be read (missing file, bad encoding, ...)."""
