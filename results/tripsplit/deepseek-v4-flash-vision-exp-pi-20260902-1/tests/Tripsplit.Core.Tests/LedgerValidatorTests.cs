using Tripsplit.Core;
using Xunit;

namespace Tripsplit.Core.Tests;

public class LedgerValidatorTests
{
    public static TheoryData<string> InvalidMemberNames => new()
    {
        { " " },
        { new string('a', 41) },
    };

    public static TheoryData<long> NonPositiveAmounts => new()
    {
        { 0L },
        { -5L },
    };

    public static TheoryData<string[]> DuplicateParticipantCases => new()
    {
        { new[] { "bob", "bob" } },
        { new[] { "bob", "BOB" } },
    };

    [Fact]
    public void rejects_members_empty_with_MEMBERS_EMPTY()
    {
        var err = LedgerValidator.Validate(new Ledger(Array.Empty<string>(), Array.Empty<Expense>()));
        Assert.Equal("MEMBERS_EMPTY", err!.Code);
    }

    [Fact]
    public void accepts_valid_ledger()
    {
        var ledger = new Ledger(
            new[] { "alice", "bob" },
            new[] { new Expense("alice", 1000, new[] { "alice", "bob" }) });
        Assert.Null(LedgerValidator.Validate(ledger));
    }

    [Theory]
    [MemberData(nameof(InvalidMemberNames))]
    public void rejects_empty_or_overlong_member_name_with_MEMBER_INVALID(string memberName)
    {
        var err = LedgerValidator.Validate(new Ledger(new[] { memberName }, Array.Empty<Expense>()));
        Assert.Equal("MEMBER_INVALID", err!.Code);
    }

    [Fact]
    public void rejects_case_insensitive_duplicate_member_with_MEMBER_DUPLICATE()
    {
        var err = LedgerValidator.Validate(new Ledger(new[] { "alice", "ALICE" }, Array.Empty<Expense>()));
        Assert.Equal("MEMBER_DUPLICATE", err!.Code);
    }

    [Fact]
    public void rejects_unknown_payer_with_MEMBER_UNKNOWN()
    {
        var err = LedgerValidator.Validate(new Ledger(
            new[] { "alice" },
            new[] { new Expense("zed", 100, new[] { "alice" }) }));
        Assert.Equal("MEMBER_UNKNOWN", err!.Code);
        Assert.Equal("expense 1: payer 'zed' is not a declared member", err.Message);
    }

    [Fact]
    public void rejects_unknown_participant_with_MEMBER_UNKNOWN()
    {
        var err = LedgerValidator.Validate(new Ledger(
            new[] { "alice", "bob" },
            new[]
            {
                new Expense("alice", 100, new[] { "alice" }),
                new Expense("alice", 200, new[] { "alice", "zed" }),
            }));
        Assert.Equal("MEMBER_UNKNOWN", err!.Code);
        Assert.Equal("expense 2: participant 'zed' is not a declared member", err.Message);
    }

    [Theory]
    [MemberData(nameof(NonPositiveAmounts))]
    public void rejects_nonpositive_amount_with_AMOUNT_INVALID(long amountCents)
    {
        var err = LedgerValidator.Validate(new Ledger(
            new[] { "alice" },
            new[] { new Expense("alice", amountCents, new[] { "alice" }) }));
        Assert.Equal("AMOUNT_INVALID", err!.Code);
    }

    [Fact]
    public void rejects_empty_participants_with_PARTICIPANTS_EMPTY()
    {
        var err = LedgerValidator.Validate(new Ledger(
            new[] { "alice" },
            new[] { new Expense("alice", 100, Array.Empty<string>()) }));
        Assert.Equal("PARTICIPANTS_EMPTY", err!.Code);
    }

    [Theory]
    [MemberData(nameof(DuplicateParticipantCases))]
    public void rejects_duplicate_participant_with_PARTICIPANT_DUPLICATE(string[] participants)
    {
        var err = LedgerValidator.Validate(new Ledger(
            new[] { "alice", "bob" },
            new[] { new Expense("alice", 100, participants) }));
        Assert.Equal("PARTICIPANT_DUPLICATE", err!.Code);
    }

    [Fact]
    public void validates_members_empty_before_member_name_validation()
    {
        // Rule 3 (empty members) must beat rule 4/6/8 even when an expense triggers those later rules.
        var err = LedgerValidator.Validate(new Ledger(
            Array.Empty<string>(),
            new[] { new Expense("alice", 0, Array.Empty<string>()) }));
        Assert.Equal("MEMBERS_EMPTY", err!.Code);
    }

    [Fact]
    public void validates_unknown_payer_before_amount_before_participants_order()
    {
        // Within one expense, payer unknown wins over everything else.
        var payerWins = LedgerValidator.Validate(new Ledger(
            new[] { "alice" },
            new[] { new Expense("zed", 0, Array.Empty<string>()) }));
        Assert.Equal("MEMBER_UNKNOWN", payerWins!.Code);
        Assert.StartsWith("expense 1: payer", payerWins.Message);

        // Payer known but amount invalid beats participants-empty.
        var amountWins = LedgerValidator.Validate(new Ledger(
            new[] { "alice" },
            new[] { new Expense("alice", 0, Array.Empty<string>()) }));
        Assert.Equal("AMOUNT_INVALID", amountWins!.Code);

        // Amount valid but participants empty beats unknown/duplicate participant checks.
        var emptyWins = LedgerValidator.Validate(new Ledger(
            new[] { "alice" },
            new[] { new Expense("alice", 100, Array.Empty<string>()) }));
        Assert.Equal("PARTICIPANTS_EMPTY", emptyWins!.Code);

        // Participants non-empty but unknown beats duplicate participant check.
        var unknownWins = LedgerValidator.Validate(new Ledger(
            new[] { "alice" },
            new[] { new Expense("alice", 100, new[] { "zed", "zed" }) }));
        Assert.Equal("MEMBER_UNKNOWN", unknownWins!.Code);
        Assert.StartsWith("expense 1: participant", unknownWins.Message);

        // All participants known but duplicated wins.
        var duplicateWins = LedgerValidator.Validate(new Ledger(
            new[] { "alice" },
            new[] { new Expense("alice", 100, new[] { "alice", "alice" }) }));
        Assert.Equal("PARTICIPANT_DUPLICATE", duplicateWins!.Code);
    }

    [Fact]
    public void validates_expenses_in_ledger_order_reporting_first_failure()
    {
        var err = LedgerValidator.Validate(new Ledger(
            new[] { "alice", "bob" },
            new[]
            {
                new Expense("alice", 100, new[] { "alice" }),
                new Expense("zed", 100, new[] { "bob" }),
                new Expense("bob", -5, new[] { "bob" }),
            }));
        Assert.Equal("MEMBER_UNKNOWN", err!.Code);
        Assert.StartsWith("expense 2:", err.Message);
    }
}
