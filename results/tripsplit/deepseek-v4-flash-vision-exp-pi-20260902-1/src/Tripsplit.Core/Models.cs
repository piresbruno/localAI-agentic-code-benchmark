namespace Tripsplit.Core;

/// <summary>A single expense paid by one member and split among participants in array order.</summary>
public sealed record Expense(string Payer, long AmountCents, string[] Participants);

/// <summary>The full group ledger: the declared members and their expenses.</summary>
public sealed record Ledger(string[] Members, Expense[] Expenses);

/// <summary>A single settlement payment from one member to another.</summary>
public sealed record Transfer(string From, string To, long AmountCents);

/// <summary>A domain validation error carrying a stable code and a safe message.</summary>
public sealed record LedgerError(string Code, string Message);
