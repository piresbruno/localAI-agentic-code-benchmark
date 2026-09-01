using Tripsplit.Core;
using Xunit;

namespace Tripsplit.Core.Tests;

public class SettlementTests
{
    private static Ledger SampleLedger() => new(
        new[] { "alice", "bob", "carol", "dave" },
        new[]
        {
            new Expense("alice", 4000, new[] { "alice", "bob", "carol", "dave" }),
            new Expense("bob", 2500, new[] { "bob", "carol" }),
            new Expense("carol", 999, new[] { "alice", "dave" }),
        });

    public static TheoryData<long, int, long[]> SplitCases => new()
    {
        { 0L, 0, new long[0] },
        { 1000L, 1, new long[] { 1000L } },
        { 1000L, 4, new long[] { 250L, 250L, 250L, 250L } },
        { 5L, 3, new long[] { 2L, 2L, 1L } },
        { 1L, 2, new long[] { 1L, 0L } },
        { 1L, 1, new long[] { 1L } },
        { 1000L, 3, new long[] { 334L, 333L, 333L } },
    };

    [Fact]
    public void splits_rounding_residual_in_participant_order()
    {
        Assert.Equal(new long[] { 334L, 333L, 333L }, Settlement.SplitShares(1000, 3));
        Assert.Equal(new long[] { 500L, 499L }, Settlement.SplitShares(999, 2));
    }

    [Fact]
    public void gives_zero_share_when_amount_below_participant_count()
    {
        Assert.Equal(new long[] { 1L, 0L }, Settlement.SplitShares(1, 2));
    }

    [Fact]
    public void keeps_net_unchanged_for_payer_only_expense()
    {
        var ledger = new Ledger(new[] { "alice", "bob" }, new[] { new Expense("alice", 500, new[] { "alice" }) });
        Assert.Equal(new long[] { 0L, 0L }, Settlement.ComputeNets(ledger));
    }

    [Fact]
    public void simplifies_debt_chains_into_single_transfer()
    {
        var ledger = new Ledger(
            new[] { "alice", "bob", "carol" },
            new[]
            {
                new Expense("bob", 1000, new[] { "alice" }),
                new Expense("carol", 1000, new[] { "bob" }),
            });

        var transfers = Settlement.Settle(ledger);

        var transfer = Assert.Single(transfers);
        Assert.Equal("alice", transfer.From);
        Assert.Equal("carol", transfer.To);
        Assert.Equal(1000, transfer.AmountCents);
    }

    [Fact]
    public void ignores_fully_netted_members()
    {
        var ledger = new Ledger(
            new[] { "alice", "bob", "carol" },
            new[]
            {
                new Expense("alice", 900, new[] { "alice", "bob", "carol" }),
                new Expense("bob", 600, new[] { "bob", "carol" }),
            });

        var nets = Settlement.ComputeNets(ledger);
        Assert.Equal(0L, nets[1]);

        var transfers = Settlement.Settle(ledger);
        Assert.All(transfers, t => Assert.True(t.From != "bob" && t.To != "bob",
            $"net-zero member 'bob' must not appear in any transfer, but got {t}"));
    }

    private static Ledger TwoEqualCreditorLedger() => new(
        new[] { "alice", "bob", "carol", "dave" },
        new[]
        {
            new Expense("alice", 1000, new[] { "alice", "carol" }),
            new Expense("bob", 1000, new[] { "bob", "dave" }),
        });

    [Fact]
    public void breaks_creditor_ties_by_first_appearance()
    {
        var transfers = Settlement.Settle(TwoEqualCreditorLedger());
        Assert.Equal(2, transfers.Count);
        Assert.Equal("alice", transfers[0].To);
        Assert.Equal("bob", transfers[1].To);
    }

    [Fact]
    public void breaks_debtor_ties_by_first_appearance()
    {
        var transfers = Settlement.Settle(TwoEqualCreditorLedger());
        Assert.Equal(2, transfers.Count);
        Assert.Equal("carol", transfers[0].From);
        Assert.Equal("dave", transfers[1].From);
    }

    [Fact]
    public void emits_transfers_in_greedy_round_order()
    {
        var transfers = Settlement.Settle(SampleLedger());

        Assert.Equal(3, transfers.Count);
        Assert.Equal(new Transfer("dave", "alice", 1499), transfers[0]);
        Assert.Equal(new Transfer("carol", "alice", 1001), transfers[1]);
        Assert.Equal(new Transfer("carol", "bob", 250), transfers[2]);
    }

    [Fact]
    public void produces_byte_identical_output_for_equal_input()
    {
        var first = Settlement.Settle(SampleLedger());
        var second = Settlement.Settle(SampleLedger());
        Assert.Equal(first, second);

        var firstNets = Settlement.ComputeNets(SampleLedger());
        var secondNets = Settlement.ComputeNets(SampleLedger());
        Assert.Equal(firstNets, secondNets);
    }

    [Fact]
    public void computes_nets_matching_golden_balance()
    {
        Assert.Equal(new long[] { 2500L, 250L, -1251L, -1499L }, Settlement.ComputeNets(SampleLedger()));
    }

    [Theory]
    [MemberData(nameof(SplitCases))]
    public void split_boundary_matrix(long amountCents, int participantCount, long[] expected)
    {
        Assert.Equal(expected, Settlement.SplitShares(amountCents, participantCount));
    }

    [Fact]
    public void split_shares_always_sum_exactly_to_amount()
    {
        for (var amount = 1L; amount <= 10; amount++)
        {
            for (var n = 1; n <= 5; n++)
            {
                var shares = Settlement.SplitShares(amount, n);
                Assert.Equal(n, shares.Length);
                Assert.Equal(amount, shares.Sum());
            }
        }
    }

    [Fact]
    public void settle_transfer_sum_equals_total_debt()
    {
        var transfers = Settlement.Settle(SampleLedger());
        var totalDebt = Settlement.ComputeNets(SampleLedger()).Where(n => n < 0).Sum(n => -n);

        Assert.Equal(totalDebt, transfers.Sum(t => t.AmountCents));
    }

    [Fact]
    public void settle_zeroes_all_nets_after_transfers()
    {
        var ledger = SampleLedger();
        var original = Settlement.ComputeNets(ledger);
        var transfers = Settlement.Settle(ledger);
        var index = ledger.Members
            .Select((m, i) => (m, i))
            .ToDictionary(x => x.m, x => x.i);

        var after = (long[])original.Clone();
        foreach (var t in transfers)
        {
            after[index[t.To]] -= t.AmountCents;
            after[index[t.From]] += t.AmountCents;
        }

        Assert.All(after, n => Assert.Equal(0L, n));
    }

    [Fact]
    public void settle_emits_at_most_member_count_minus_one_transfers()
    {
        var transfers = Settlement.Settle(SampleLedger());
        Assert.True(transfers.Count <= SampleLedger().Members.Length - 1);
    }

    [Fact]
    public void settle_all_zero_ledger_emits_no_transfers()
    {
        var ledger = new Ledger(new[] { "alice", "bob" }, new Expense[] { new Expense("alice", 100, new[] { "alice" }) });
        Assert.Empty(Settlement.Settle(ledger));
    }
}
