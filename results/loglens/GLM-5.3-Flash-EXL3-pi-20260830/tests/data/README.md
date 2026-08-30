# Test fixtures

## `malformed.log`

65 mixed valid/invalid/ambiguous log lines used by the property-style parser
tests (`tests/unit/test_parsers_property.py`). The file intentionally mixes
JSON-lines and plain-text shapes, unknown level words, impossible dates,
empty/whitespace lines, unicode, and structural junk.

Property contract under test:

1. Parsing never raises, whatever the line contains.
2. Every line yields exactly one `LogEvent` (nothing is silently dropped).
3. Any line that cannot be fully parsed becomes a `level=UNKNOWN` event with
   a `parse_error` entry in `attributes`.
4. Parseable events always carry a UTC, timezone-aware timestamp or none at
   all — never a naive datetime.
