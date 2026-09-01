# Tripsplit — Group-Expense Settlement CLI

A deterministic .NET 8 console tool that settles shared expenses: read a JSON
ledger of expenses (payer, amount in integer cents, participants), compute each
member's net balance, and emit a minimal, byte-stable settlement plan.

## Quickstart (from a clean checkout)

```sh
dotnet build
dotnet run --project src/Tripsplit.Cli -- settle --ledger sample/ledger.json
dotnet test
```

No setup, no network at runtime, no environment variables. `src/` uses the BCL
only (System.Text.Json is inbox) — zero NuGet `PackageReference` in production
code.

## Commands

```
tripsplit settle  --ledger <file> [--format table|json]
tripsplit balance --ledger <file> [--format table|json]
tripsplit --help | -h
tripsplit --version | -v
```

`--format` defaults to `table`. Data goes to stdout; errors go to stderr as one
single-line JSON envelope; nothing else is ever printed.

## Architecture

```
Tripsplit.sln
├── src/
│   ├── Tripsplit.Core/   # ALL business logic: model, split, netting, settle,
│   │                     # validation, error type. PURE: no Console, no I/O,
│   │                     # no JSON, BCL only. Money is long (integer cents).
│   └── Tripsplit.Cli/    # Program.Main, arg parsing, ledger loading
│                         # (System.Text.Json), pure formatters, exit codes
├── sample/ledger.json    # §6.3 fixture
└── tests/
    ├── Tripsplit.Core.Tests/   # pure unit tests, every §5 rule by name
    └── Tripsplit.Cli.Tests/    # in-process Program.Main: golden bytes + codes
```

Core owns every business rule — split residual, netting, the pinned greedy
settle with defined tie-breaking (creditor = max net, earliest declaration
position; debtor = min net, earliest position). The CLI only maps argv → core
calls → output and maps domain errors to the envelope and exit codes.

## Ledger schema

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

- `members`: non-empty; each name non-empty after trim, ≤ 40 chars; unique
  case-insensitively. Declaration order is significant.
- `expenses`: payer must be a declared member; `amountCents` integer > 0
  (a non-integer like `12.5` is a strict error, never truncated);
  `participants` ≥ 1 name, no duplicates, may or may not include the payer.
- Unknown top-level or expense keys are ignored. Names are trimmed on load.

## Worked example (§6.4 golden output)

```
$ dotnet run --project src/Tripsplit.Cli -- settle --ledger sample/ledger.json
dave   -> alice  €14.99
carol  -> alice  €10.01
carol  -> bob    €2.50
settled €27.50 in 3 transfers (4 members)
```

Balances for the same ledger: alice +€25.00, bob +€2.50, carol −€12.51,
dave −€14.99. Output is byte-deterministic across runs (no timestamps, no
culture-sensitive formatting, invariant culture enforced at the entry point).

## Errors

Every failure prints one single-line JSON object to stderr:

```json
{"error":{"code":"MEMBER_UNKNOWN","message":"expense 2: participant 'zed' is not a declared member"}}
```

Messages never leak stack traces, exception types, or internal paths. Expense
numbers in messages are 1-based and follow the first-failure validation order
(§5 of the spec).

| Exit | Meaning | Codes |
|------|---------|-------|
| 0 | success | — |
| 1 | validation / data error | `LEDGER_NOT_FOUND`, `LEDGER_INVALID`, `MEMBERS_EMPTY`, `MEMBER_INVALID`, `MEMBER_DUPLICATE`, `MEMBER_UNKNOWN`, `AMOUNT_INVALID`, `PARTICIPANTS_EMPTY`, `PARTICIPANT_DUPLICATE` |
| 2 | usage error | `USAGE` |

## Testing & coverage

- `dotnet test` — 64 tests, all passing, none skipped.
- Coverage gate: `dotnet test --collect:"XPlat Code Coverage"` (coverlet);
  merged line coverage on `src/Tripsplit.Core` + `src/Tripsplit.Cli` is
  **96.31%** (gate: ≥ 85%).
- CLI tests invoke `Program.Main(string[])` **in process** (subprocess launch
  is banned by the spec — see `docs/DECISIONS.md`).

## Decisions & deviations

See `docs/DECISIONS.md` for the residual-policy rationale, tie-breaking
policy, why CLI tests run in-process, why `long` cents over `decimal`, and
the accepted production LOC total (512 vs the spec's 250–350 advisory).
