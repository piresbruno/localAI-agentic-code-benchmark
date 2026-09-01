namespace Tripsplit.Core;

/// <summary>Pure functions for splitting, netting and settling a <see cref="Ledger"/>.</summary>
public static class Settlement
{
    /// <summary>Splits <paramref name="amountCents"/> into equal integer shares, the first <c>r</c> participants taking one extra cent.</summary>
    public static long[] SplitShares(long amountCents, int participantCount)
    {
        var shares = new long[participantCount];
        if (participantCount == 0)
            return shares;
        var share = amountCents / participantCount;
        var residual = amountCents % participantCount;
        for (var i = 0; i < participantCount; i++)
            shares[i] = share + (i < residual ? 1 : 0);
        return shares;
    }

    /// <summary>Computes each member's net balance (paid minus owed) in members declaration order.</summary>
    public static long[] ComputeNets(Ledger ledger)
    {
        var nets = new long[ledger.Members.Length];
        var index = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < ledger.Members.Length; i++)
            index[ledger.Members[i].Trim()] = i;

        foreach (var expense in ledger.Expenses)
        {
            nets[index[expense.Payer.Trim()]] += expense.AmountCents;
            var shares = SplitShares(expense.AmountCents, expense.Participants.Length);
            for (var j = 0; j < expense.Participants.Length; j++)
                nets[index[expense.Participants[j].Trim()]] -= shares[j];
        }

        return nets;
    }

    /// <summary>Produces the deterministic greedy settlement plan (§5 pinned algorithm).</summary>
    public static List<Transfer> Settle(Ledger ledger)
    {
        var net = ComputeNets(ledger);
        var members = ledger.Members;
        var transfers = new List<Transfer>();

        while (true)
        {
            var creditor = -1;
            var maxNet = long.MinValue;
            for (var i = 0; i < net.Length; i++)
            {
                if (net[i] > maxNet)
                {
                    maxNet = net[i];
                    creditor = i;
                }
            }

            if (maxNet == 0)
                break;

            var debtor = -1;
            var minNet = long.MaxValue;
            for (var i = 0; i < net.Length; i++)
            {
                if (net[i] < minNet)
                {
                    minNet = net[i];
                    debtor = i;
                }
            }

            var amount = Math.Min(maxNet, -minNet);
            transfers.Add(new Transfer(members[debtor], members[creditor], amount));
            net[creditor] -= amount;
            net[debtor] += amount;
        }

        return transfers;
    }
}
