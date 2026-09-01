# Tripsplit — Group-Expense Settlement CLI

**Version**: 1.0.0 (probe-tier edition)
**Stack**: C# / .NET 8 console app, xUnit. **Zero NuGet `PackageReference` in `src/`** (BCL only — `System.Text.Json` is inbox); test projects may reference xUnit + coverlet.
**Audience**: AI coding agents evaluated on a small, exactness-critical .NET CLI.

> **Probe-tier scope.** Unlike the 600–1,000 LOC projects, this probe targets
> **250–350 LOC** (350 advised). Discrimination comes from edge-case depth,
> a pinned algorithm, and byte-deterministic output — not feature breadth.
> Everything specified here is required; nothing is optional.

---

## 1. Overview & Goals

Build **Tripsplit**, a CLI that settles shared expenses: read a JSON ledger of
expenses (who paid, how much in integer cents, who participated), compute each
member's net balance, and emit a **minimal, deterministic settlement plan**.

**Why this exists.** This project grades an agent's ability to:
- Translate a written spec into a working .NET console app.
- Implement a **pinned algorithm exactly** — not "any correct answer", but THE
  specified greedy settle with defined tie-breaking (§5).
- Produce **byte-deterministic output**: same input → identical bytes, every run.
- Do money-safe math: integer cents only; floating point = fail.
- Validate every boundary input into one error model with documented exit codes.

**LOC expectation.** 250–350 lines of production C# under `src/` (350 advised).
Tests and the sample fixture are excluded from the count but belong in the repo.
Significantly less than 250 usually means features are missing; significantly
more than 350 usually means over-engineering. This probe is graded on
exactness, not volume.

## 2. Success criterion (pass/fail)

ALL of the following must be true:

1. **Sandboxed** — no dependencies on anything outside the run directory.
2. **Ready to run** — from a clean checkout: `dotnet build`, then
   `dotnet run --project src/Tripsplit.Cli -- --help` exits 0. Zero
   `PackageReference` in `src/` (BCL only). No network at runtime, no manual
   setup.
3. **Fixture works** — `sample/ledger.json` committed **verbatim** from §6.3;
   `settle` and `balance` on it reproduce §6.4's golden outputs **byte-exactly**
   in both formats (SMOKE_CHECK verifies this).
4. **All tests pass**, and **line coverage ≥ 85%** (coverlet) on
   `src/Tripsplit.Core/**` + `src/Tripsplit.Cli/**`.
5. **`--help` is complete** per §7.
6. **Zero build warnings**; `<Nullable>enable</Nullable>` set on all projects.

## 3. Architecture (REQUIRED — deviations = fail)

```
Tripsplit/
├── Tripsplit.sln
├── src/
│   ├── Tripsplit.Core/     # ALL business logic: model, split, netting, settle,
│   │                       # validation, error types. PURE: no Console.*,
│   │                       # no file I/O, no JSON, no NuGet references.
│   └── Tripsplit.Cli/      # Program.cs, arg parsing, ledger loading
│                           # (System.Text.Json), formatters, exit-code mapping
├── sample/
│   └── ledger.json         # §6.3 fixture, committed verbatim
└── tests/
    ├── Tripsplit.Core.Tests/   # pure unit tests; every §5 rule by name
    └── Tripsplit.Cli.Tests/    # in-process Main(argv); golden bytes + exit codes
```

Rules:
- **Core contains all business rules** and references nothing beyond the BCL.
  Domain records own their invariants; split/net/settle are pure functions.
- **Cli maps**: argv → core calls → output. No business rules in `Program.cs`.
- Formatters are **pure functions returning strings** (no `Console` inside) so
  golden tests never touch a real terminal.
- **Money is `long` (integer cents) everywhere.** Amounts must never pass
  through `double`, `float`, or `decimal`; euro formatting uses integer
  arithmetic (§6.2). Violation = fail (graders grep for it).
- Domain validation produces typed errors carrying `code` + safe message; only
  `Tripsplit.Cli` maps them to the error envelope and exit codes.
- All console writes go through `Console.Out` / `Console.Error` (redirectable).

## 4. Domain model

**Member**: `name` — non-empty after trim, ≤ 40 chars, unique case-insensitive.
Members are declared once in the ledger's `members` array; **input order is
significant** (tie-breaking §5, output ordering §6.2).

**Expense**: `payer` (a member name), `amountCents` (integer > 0),
`participants` (≥ 1 member names, no duplicates within one expense; the payer
may or may not participate).

**Split rule (equal, with pinned residual).** `share = amountCents / n`
(integer division), residual `r = amountCents % n`; the **first `r`
participants in array order** each pay one extra cent. Shares always sum
exactly to `amountCents`. Examples: 1000÷3 → [334, 333, 333]; 999÷2 →
[500, 499]; 1÷2 → [1, 0].

**Net balance**: per member = Σ(amounts they paid) − Σ(their shares). A
payer-only expense (`payer` is the only participant) is valid and nets to zero
change.

**Transfer**: `from`, `to`, `amountCents` > 0.

**Ledger JSON schema**:
```json
{
  "members": ["alice", "bob"],
  "expenses": [
    { "payer": "alice", "amountCents": 1000, "participants": ["alice", "bob"] }
  ]
}
```
Unknown top-level or expense keys are ignored. Types are strict: a non-integer
`amountCents` (e.g. `12.5`) is an error, never a truncation.

## 5. Business rules (each needs a test named for it)

**Settlement algorithm (pinned — implement exactly):**

```
# nets as in §4; members keep their ledger-declaration order
while any net ≠ 0:
    creditor = member with the maximum net; ties → earliest position in members
    debtor   = member with the minimum net; ties → earliest position in members
    amount   = min(creditor.net, −debtor.net)
    emit transfer (debtor → creditor, amount)
    creditor.net −= amount; debtor.net += amount
```

Total net is always 0 (shares sum to the amount), so the loop terminates.
**Emission order is output order** — formatters must not re-sort.

| Named test | Rule |
|---|---|
| `splits_rounding_residual_in_participant_order` | 1000÷3 → 334/333/333 by array order; 999÷2 → 500/499 |
| `gives_zero_share_when_amount_below_participant_count` | 1 cent ÷ 2 participants → [1, 0] |
| `keeps_net_unchanged_for_payer_only_expense` | payer-only expense changes no net |
| `simplifies_debt_chains_into_single_transfer` | bob pays 1000 for [alice]; carol pays 1000 for [bob] → exactly one transfer alice→carol 1000 |
| `ignores_fully_netted_members` | net-0 members appear in no transfer |
| `breaks_creditor_ties_by_first_appearance` | two equal creditors → earlier `members` entry is paid first |
| `breaks_debtor_ties_by_first_appearance` | two equal debtors → earlier `members` entry pays first |
| `emits_transfers_in_greedy_round_order` | output order == emission order of the pinned loop |
| `produces_byte_identical_output_for_equal_input` | running settle (and balance) twice → identical bytes, both formats |

**Validation rules** — checked in this order; first failure wins and aborts:

| # | Trigger | Code | Exit |
|---|---------|------|------|
| 1 | `--ledger` path missing or unreadable | `LEDGER_NOT_FOUND` | 1 |
| 2 | malformed JSON, wrong types (e.g. `amountCents: 12.5`, `members` not an array), missing required fields | `LEDGER_INVALID` | 1 |
| 3 | `members` array empty | `MEMBERS_EMPTY` | 1 |
| 4 | member name empty after trim, or > 40 chars | `MEMBER_INVALID` | 1 |
| 5 | duplicate member names (case-insensitive) | `MEMBER_DUPLICATE` | 1 |
| 6 | expense references unknown payer or participant | `MEMBER_UNKNOWN` | 1 |
| 7 | `amountCents` ≤ 0 | `AMOUNT_INVALID` | 1 |
| 8 | expense with no participants | `PARTICIPANTS_EMPTY` | 1 |
| 9 | same member twice in one expense's participants | `PARTICIPANT_DUPLICATE` | 1 |
| 10 | unknown subcommand/flag, missing `--ledger`, bad `--format` value, no args | `USAGE` | 2 |

Expenses are validated in ledger order; within one expense: payer → amount →
participants (empty → unknown → duplicated).

**Error envelope (the one error model).** Every failure — including usage
errors — prints **one single-line JSON object to stderr**:

```json
{"error":{"code":"MEMBER_UNKNOWN","message":"expense 2: participant 'zed' is not a declared member"}}
```

Messages are safe (no stack traces, exception types, or paths beyond the
user-supplied `--ledger` value); expenses are numbered from 1. Exit codes:
**0** success, **1** validation/data (`LEDGER_*`, `MEMBER*`, `AMOUNT_*`,
`PARTICIPANT*`), **2** usage (`USAGE`).

## 6. CLI surface & golden outputs

### 6.1 Commands

```
tripsplit settle  --ledger <file> [--format table|json]
tripsplit balance --ledger <file> [--format table|json]
tripsplit --help | -h
tripsplit --version | -v
```

`--format` defaults to `table`.

### 6.2 Format rules (deterministic)

- Data output on **stdout**; errors on **stderr**; nothing else on either.
- Names left-justified to the longest member name, exactly two spaces between
  columns; amounts as `€{whole}.{cents:D2}` via integer arithmetic; ASCII `-`
  only (no Unicode minus, no ANSI colours, invariant culture).
- `balance` (table): one line per member in **ledger order** —
  `<name>  <sign>€<amount>` with `+` for net ≥ 0, `-` for net < 0.
- `settle` (table): one row per transfer in emission order —
  `<from>  -> <to>  €<amount>` — then exactly one summary line:
  `settled €<total> in <n> transfers (<m> members)`.
- JSON mode: **single line**, keys in the exact order shown in §6.4, integer
  cents, UTF-8, newline-terminated.

### 6.3 Fixture — commit verbatim as `sample/ledger.json`

```json
{
  "members": ["alice", "bob", "carol", "dave"],
  "expenses": [
    { "payer": "alice", "amountCents": 4000, "participants": ["alice", "bob", "carol", "dave"] },
    { "payer": "bob", "amountCents": 2500, "participants": ["bob", "carol"] },
    { "payer": "carol", "amountCents": 999, "participants": ["alice", "dave"] }
  ]
}
```

Nets: alice +2500, bob +250, carol −1251, dave −1499.

### 6.4 Golden outputs for the fixture

`balance` (table):
```
alice  +€25.00
bob    +€2.50
carol  -€12.51
dave   -€14.99
```

`settle` (table):
```
dave   -> alice  €14.99
carol  -> alice  €10.01
carol  -> bob    €2.50
settled €27.50 in 3 transfers (4 members)
```

`balance --format json`:
```json
{"balances":[{"member":"alice","netCents":2500},{"member":"bob","netCents":250},{"member":"carol","netCents":-1251},{"member":"dave","netCents":-1499}]}
```

`settle --format json`:
```json
{"transfers":[{"from":"dave","to":"alice","amountCents":1499},{"from":"carol","to":"alice","amountCents":1001},{"from":"carol","to":"bob","amountCents":250}],"totalCents":2750,"memberCount":4}
```

`--version` prints `tripsplit 1.0.0` (exit 0). An all-zero ledger prints
`settled €0.00 in 0 transfers (<m> members)` and `"transfers":[]`.

## 7. CLI/UX & output quality (scored, not optional polish)

The CLI/UX category (rubric ×1.5) is graded on:

- **`--help` completeness** (exit 0, stdout): both subcommands; every flag with
  meaning and default; all three exit codes with meanings; the error-envelope
  shape; the ledger schema with the §6.3 fixture inline; one worked settle
  example. This is the CLI's documentation — the grader reads it as such.
- **Determinism**: same input → byte-identical stdout across runs. No
  timestamps, no culture-sensitive formatting, no dictionary-order dependence.
- **Stream discipline**: data on stdout, errors on stderr; grader pipes stdout
  to a file and greps for stray output.
- **Safe errors**: envelope messages never leak stack traces, exception types,
  or internal paths.
- **Piped-stable output**: no ANSI codes or colours.

### How it's verified

Grader runs settle/balance on the fixture and byte-compares to §6.4; breaks
the ledger in each §5 way and checks code + message + exit status; runs
`--help` / `--version`; pipes stdout and inspects stderr; runs twice to
confirm determinism.

## 8. Testing requirements

- **`Tripsplit.Core.Tests`**: every §5 rule by name; split boundary matrix
  (n=1, residual 0, residual n−1, 1-cent totals); settle invariants (transfers
  sum equals total debt; all nets zero after; at most n−1 transfers). Pure
  functions — no mocks, no I/O.
- **`Tripsplit.Cli.Tests`**: invoke `Program.Main(string[] argv)` **in
  process**; capture `Console.Out` / `Console.Error`; assert exit code and
  exact bytes for: `--help`, `--version`, settle/balance × table/json on the
  §6.3 fixture, one case per §5 error code, and usage errors.
  **Launching the CLI as a subprocess (`Process.Start`) in tests is banned** —
  it silently dodges the coverage gate.
- Determinism test: run settle twice in-process, byte-compare.
- Zero warnings; `Nullable` enabled; `TreatWarningsAsErrors` (or equivalent).
- Coverage ≥ 85% lines on `src/Tripsplit.Core/**` + `src/Tripsplit.Cli/**`
  (coverlet).

## 9. Commands

| Purpose | Command |
|---|---|
| Build | `dotnet build` |
| Run | `dotnet run --project src/Tripsplit.Cli -- <command> --ledger sample/ledger.json` |
| Test | `dotnet test` |
| Coverage | `dotnet test --collect:"XPlat Code Coverage"` |

## 10. Documentation

README: goal, quickstart (≤ 3 cmds), architecture overview, ledger schema, the
§6.4 worked example, exit-code + error-code table, test/coverage instructions.
`docs/DECISIONS.md`: residual policy rationale, tie-breaking policy, why CLI
tests run in-process, why `long` cents over `decimal`.
