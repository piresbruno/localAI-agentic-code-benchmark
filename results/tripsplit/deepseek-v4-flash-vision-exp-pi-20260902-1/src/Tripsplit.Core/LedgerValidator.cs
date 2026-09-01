namespace Tripsplit.Core;

/// <summary>Validates a <see cref="Ledger"/> per §5 rules 3-9, in strict order.</summary>
public static class LedgerValidator
{
    /// <summary>Returns the first rule violation, or <c>null</c> when the ledger is valid.</summary>
    public static LedgerError? Validate(Ledger ledger)
    {
        // Rule 3: members array must not be empty.
        if (ledger.Members.Length == 0)
            return new LedgerError("MEMBERS_EMPTY", "members array is empty");

        // Rule 4: each member name must be non-empty after trim and at most 40 chars.
        foreach (var member in ledger.Members)
        {
            var trimmed = member.Trim();
            if (trimmed.Length == 0)
                return new LedgerError("MEMBER_INVALID", "member name is empty");
            if (trimmed.Length > 40)
                return new LedgerError("MEMBER_INVALID", $"member name '{trimmed}' is longer than 40 characters");
        }

        // Rule 5: member names must be unique case-insensitively.
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        foreach (var member in ledger.Members)
        {
            var trimmed = member.Trim();
            if (!seen.Add(trimmed))
                return new LedgerError("MEMBER_DUPLICATE", $"duplicate member '{trimmed}'");
        }

        var known = new HashSet<string>(ledger.Members.Select(m => m.Trim()), StringComparer.OrdinalIgnoreCase);

        // Rules 6-9: expenses validated in ledger order.
        for (var i = 0; i < ledger.Expenses.Length; i++)
        {
            var expense = ledger.Expenses[i];
            var n = i + 1;

            // Rule 6 (payer): the payer must be a declared member.
            if (!known.Contains(expense.Payer.Trim()))
                return new LedgerError("MEMBER_UNKNOWN", $"expense {n}: payer '{expense.Payer.Trim()}' is not a declared member");

            // Rule 7: amount must be positive.
            if (expense.AmountCents <= 0)
                return new LedgerError("AMOUNT_INVALID", $"expense {n}: amount must be positive");

            // Rule 8: participants must not be empty.
            if (expense.Participants.Length == 0)
                return new LedgerError("PARTICIPANTS_EMPTY", $"expense {n}: participants is empty");

            // Rule 6 (participants): each participant must be a declared member.
            foreach (var participant in expense.Participants)
            {
                if (!known.Contains(participant.Trim()))
                    return new LedgerError("MEMBER_UNKNOWN", $"expense {n}: participant '{participant.Trim()}' is not a declared member");
            }

            // Rule 9: no participant may appear twice in one expense.
            var seenParticipants = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            foreach (var participant in expense.Participants)
            {
                var trimmed = participant.Trim();
                if (!seenParticipants.Add(trimmed))
                    return new LedgerError("PARTICIPANT_DUPLICATE", $"expense {n}: duplicate participant '{trimmed}'");
            }
        }

        return null;
    }
}
