"""Configuration model for a single rule."""

from typing import Any

from pydantic import BaseModel, Field


class RuleConfig(BaseModel):
    """Enable/disable switch and parameter overrides for one rule.

    ``params`` holds raw values from the config file; each rule validates and
    coerces the keys it knows in ``configure()``.
    """

    name: str
    enabled: bool = True
    params: dict[str, Any] = Field(default_factory=dict)
