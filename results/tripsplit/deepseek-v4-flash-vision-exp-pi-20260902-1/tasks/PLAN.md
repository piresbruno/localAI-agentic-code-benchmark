# PLAN — tripsplit

**Agent/Model**: deepseek-v4-flash-vision-exp / pi
**Started**: 2026-09-02
**Spec**: /home/piresbruno/developer/code-benchmark/specs/03-csharp-tripsplit/SPEC.md
**Mode**: unattended: plan self-approved

## Understanding of the task

Build Tripsplit, a .NET 8 console CLI that reads a JSON expense ledger (integer
cents only), computes per-member net balances with a pinned equal-split
residual rule (first r participants in array order pay one extra cent), and
emits a deterministic greedy settlement plan with defined tie-breaking
(creditor = max net / earliest position, debtor = min net / earliest
position). Hard parts: byte-deterministic golden output (table + single-line
JSON, exact column widths, `long` cents, invariant culture), the ordered
10-rule validation model with one JSON error envelope on stderr and exact
exit codes, and ≥85% line coverage on Core+Cli while staying near the
250–350 LOC target. Architecture is mandated: pure Core (no I/O/JSON/Console)
+ thin CLI (System.Text.Json loader, pure formatters, exit-code mapping);
tests invoke `Program.Main` in process (subprocess launch banned).

## Task breakdown

- [x] T0 — Scaffold foundation: Tripsplit.sln, 4 csproj projects (Zero NuGet in src/, Nullable+TreatWarningsAsErrors), sample/ledger.json verbatim, .gitignore
      Accept: `dotnet build` green on empty skeleton.
- [ ] T1 — Core domain: Models, LedgerValidator (rules 3–9 in order), Settlement (SplitShares, ComputeNets, Settle pinned algorithm)
      Accept: Core unit tests green; every §5 rule named test present.
- [ ] T2 — Core tests: split boundary matrix, settle invariants (sum == total debt, nets zero after, ≤ n−1 transfers), all §5 named rules
      Accept: all pass; no I/O in Core tests.
- [ ] T3 — CLI: Arguments parser (USAGE errors), LedgerLoader (strict JSON → LEDGER_INVALID), pure Formatters (table+json, §6.2), Program.Main (dispatch, envelope, exit codes)
      Accept: fixture settle/balance byte-match §6.4 in both formats; --help/--version exact.
- [ ] T4 — CLI tests in-process: golden bytes, one case per §5 error code + exit status, usage errors, determinism (settle+balance twice → byte-identical)
      Accept: all pass; no Process.Start.
- [ ] T5 — Quality gates: dotnet build zero warnings; dotnet test 100% green; coverage ≥85% line on Core+Cli via coverlet; smoke: --help exit 0, fixture byte-match via dotnet run
      Accept: measured numbers recorded truthfully.
- [ ] T6 — Docs: README (goal, ≤3-cmd quickstart, architecture, schema, §6.4 example, error/exit tables, test+coverage) and docs/DECISIONS.md (residual policy, tie-breaking, in-process tests, long cents)
      Accept: README + DECISIONS committed; clean-checkout run in ≤3 commands works.
- [ ] T7 — Bookkeeping: LOC count, METRICS.md yaml, BENCHMARKS.md status+log row, final report
      Accept: BENCHMARKS.md row updated; closing commit.

## Cross-slice contract (Core public API — frozen, agents code against it)

```csharp
namespace Tripsplit.Core;
public sealed record Expense(string Payer, long AmountCents, string[] Participants);
public sealed record Ledger(string[] Members, Expense[] Expenses);
public sealed record Transfer(string From, string To, long AmountCents);
public sealed record LedgerError(string Code, string Message);

public static class LedgerValidator
{
    // Returns the FIRST error in §5 rule order (3..9), or null when valid.
    // Codes: MEMBERS_EMPTY, MEMBER_INVALID, MEMBER_DUPLICATE, MEMBER_UNKNOWN,
    // AMOUNT_INVALID, PARTICIPANTS_EMPTY, PARTICIPANT_DUPLICATE.
    // Messages: safe, no types/paths; expenses numbered from 1; payer checked
    // before amount before participants; unknown participant message uses the
    // spec's exact example pattern: "expense N: participant 'x' is not a declared member".
    public static LedgerError? Validate(Ledger ledger);
}

public static class Settlement
{
    // n == participantCount; share = amount / n, first (amount % n) entries +1.
    public static long[] SplitShares(long amountCents, int participantCount);
    // Index-aligned with ledger.Members; per member: paid − Σ shares.
    public static long[] ComputeNets(Ledger ledger);
    // Pinned greedy loop: while any net != 0 → creditor = max net (ties earliest
    // index), debtor = min net (ties earliest index), amount = min(c, −d);
    // emit (debtor → creditor, amount) in emission order; update nets.
    public static List<Transfer> Settle(Ledger ledger);
}
```

## Decisions & spec deviations

| # | Decision / deviation | Justification |
|---|---------------------|---------------|
| 1 | Member/payer/participant names trimmed at load before validation | Keeps golden widths and dup checks sane for whitespace-padded names; documented in DECISIONS.md |
| 2 | Duplicate check inside one expense's participants is case-insensitive | Members are unique case-insensitively; same member twice under different case is a duplicate |
| 3 | Errors (incl. USAGE) print only the JSON envelope to stderr — no extra help text | §5: "Every failure prints one single-line JSON object to stderr"; keeps stderr garbage-free |
| 4 | JSON output built via System.Text.Json on ordered anonymous/record DTOs | Deterministic key order, correct escaping, no hand-rolled encoder |
| 5 | Messages for codes other than MEMBER_UNKNOWN chosen by us (spec gives only that example) | Spec pins one example message; others follow same safe pattern |
| 6 | `--help`/`--version`/`-h`/`-v` handled before subcommand parsing; `settle|balance --help` not required | §6.1 lists only top-level help; avoids unneeded surface |
| 7 | LOC monitored; 350 is advisory (per repo commit "350 LOC cap advisory") — small overage accepted and reported if needed | Correctness + mandated completeness > artificial cap |

## Final report (fill at the end)

- Wall-clock time:
- Total tokens consumed (in + out) + avg output t/s (if the harness exposes them; state source):
- Errors/retries (build/test/lint):
- Final coverage (number + measurement command):
- Line counts per directory:
- Deviations from spec:
