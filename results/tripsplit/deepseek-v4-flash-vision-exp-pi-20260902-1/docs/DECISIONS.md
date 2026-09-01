# DECISIONS — Tripsplit

## Residual policy (split rule)

The spec pins a single equal-split-with-residual algorithm: `share = amount / n`
(integer division) and the **first `r = amount % n` participants in array
order** each receive one extra cent. This fixes the only ambiguity in equal
splitting and guarantees shares sum **exactly** to the amount. Alternatives
(e.g. "largest remainder to the payer", or distributing residual by position
only when the payer participates) would produce different nets and therefore
different settlement plans. Because the spec requires byte-exact golden output
on the fixture, and its §6.4 result depends on this exact rule, we implement
the pinned rule verbatim, with zero deviation.

## Tie-breaking policy

The pinned settle algorithm selects the creditor as the member with the
maximum net (ties → earliest position in the ledger `members` array) and the
debtor as the member with the minimum net (ties → earliest position). This is
implemented by scanning the net array in declaration order with strict `>` /
`<` comparisons, so the earliest index naturally wins ties; the scan order is
the only source of tie-breaking, and emission order is the loop's order.
Deliberately using `>=`/`<=` would flip the golden §6.4 transfer order
(carol→bob would be emitted before carol→alice), so the direction is asserted
by the `breaks_creditor_ties_by_first_appearance` /
`breaks_debtor_ties_by_first_appearance` tests.

## Why CLI tests run in-process

The spec bans launching the CLI as a subprocess in tests (`Process.Start`):
subprocess tests silently dodge the coverage gate because coverlet only
instruments the test host. Instead, every CLI test calls
`Program.Main(string[])` directly, captures `Console.Out`/`Console.Error`
through `Console.SetOut/SetError(StringWriter)` (restored in `finally`), and
asserts exact bytes and exit codes. `[assembly: CollectionBehavior(DisableTestParallelization = true)]`
protects the process-global console state. This keeps the full CLI code path —
parser, loader, formatters, envelope, exit-code mapping — inside the
instrumented coverage boundary (measured 93.9% lines on `Tripsplit.Cli`).

## Why `long` cents and not `decimal` (or `double`)

All money values are integer cents stored as `long`:

- The ledger schema and output formats deal exclusively in integer cents;
  there is no arithmetic that would benefit from fractional precision.
- Integer arithmetic is exact and culture-independent by construction; the
  only formatting operation is `whole = abs / 100; cents = abs % 100`, which
  cannot produce `0.1 + 0.2 != 0.3`-style surprises.
- A non-integer ledger value like `12.5` must be a **hard error**, never a
  silent truncation — `long` plus strict deserialization makes that the only
  possible behavior.
- The spec greps production code for `double`/`float`/`decimal`; there are
  none in `src/`.

## Member names are trimmed at load

`members`, `payer`, and every entry of `participants` are trimmed
(leading/trailing whitespace) immediately after JSON deserialization, before
validation and computation. Rationale: "non-empty after trim" and the
≤ 40-char rule imply the trimmed form is the identity, and trimming at the
loader keeps width calculations and case-insensitive duplicate checks
consistent (e.g. `" alice "` and `"alice"` cannot silently become two
distinct members). The Core validator additionally trims defensively because
it is a public pure API.

## Duplicate participants are case-insensitive

Members are declared unique case-insensitively, so `"Alice"` and `"alice"` in
one expense's `participants` refer to the same member; per §5 rule 9 that is a
`PARTICIPANT_DUPLICATE`, checked after trim with
`StringComparer.OrdinalIgnoreCase`.

## Error envelope for usage errors

§5 states that *every* failure — including usage errors — prints exactly one
single-line JSON object to stderr. We therefore print the `USAGE` envelope and
nothing else (no help text on stderr, stdout stays empty). This makes stderr
machine-parseable for every failure mode and keeps the "piped-stable output"
requirement.

## Invariant culture at the entry point

`Program.Main` sets `CultureInfo.CurrentCulture = InvariantCulture` first.
Number interpolation (e.g. `cents:00`, "in 3 transfers") must not depend on the
host locale — under `ar-SA` the default formatter emits Arabic-Indic digits,
which would break byte-comparisons of golden output. JSON serialization is
already culture-invariant via System.Text.Json.

## JSON output strategy

Settle/balance JSON is produced with `System.Text.Json` over ordered anonymous
types so key order exactly matches §6.4 (`transfers`, `totalCents`,
`memberCount`; `member`, `netCents`), single-line, UTF-8, newline-terminated,
with `UnsafeRelaxedJsonEscaping` so non-ASCII names are emitted as raw UTF-8
(deterministic; the envelopes preserve the spec's exact message with
apostrophes — see `MEMBER_UNKNOWN` test asserting the literal
`participant 'zed'`).

## Production LOC: 512 (spec advisory 250–350)

The packed, fully-tested implementation lands at **512 production C# lines**
(Core 164, Cli 348), above the spec's 250–350 advisory. No feature is
speculative and nothing was dropped: the spec mandates 10 validation rules,
two commands × two formats, a ~48-line complete `--help`, a strict-typed
loader, ordered golden formatters, and a pinned algorithm — all of which are
present verbatim. See also README "Decisions & deviations". Deviating downward
(to hit the number) would have cut spec-mandated surface; we accept the
overage and keep fidelity.
