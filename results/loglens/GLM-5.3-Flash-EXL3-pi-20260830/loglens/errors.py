"""The single error model for LogLens.

Domain errors carry a machine-readable code and a safe message; the CLI maps
them to exit codes (config → 2, input/IO → 3). Internal details never leak
into the messages.
"""

from typing import Any


class LogLensError(Exception):
    """Base class for all LogLens domain errors."""

    code = "loglens_error"

    def __init__(self, message: str, **details: Any) -> None:
        super().__init__(message)
        self.message = message
        self.details = details


class InputError(LogLensError):
    """A problem with user-provided input files (missing, unreadable, empty glob)."""

    code = "input_error"


class ConfigError(LogLensError):
    """An invalid configuration file or value; carries file and line when known."""

    code = "config_error"

    def __init__(self, message: str, file: str | None = None, line: int | None = None) -> None:
        location = ""
        if file is not None:
            location = f"{file}:"
            if line is not None:
                location += f"{line}:"
            location += " "
        super().__init__(f"{location}{message}", file=file, line=line)
        self.file = file
        self.line = line
